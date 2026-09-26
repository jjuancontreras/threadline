// FREE SWING: hold to fire a tether at the nearest building along the aim, release to let go
// (momentum preserved, auto-trick at speed). On the street or a roof: WASD runs (A/D turn),
// Shift sprints, Space jumps; Q performs a trick in the air. Touch: tap-hold fires, lift releases.
import * as THREE from 'three';
import { createSwinger, step, attach, release, velocity } from '../physics/swinger.js';
import { pickAnchor } from '../physics/anchors.js';
import { towersNear } from '../core/layout.js';
import { vNorm, vAdd, vScale, vSub, vLen, vLerp, smoothstep, clamp } from '../core/math.js';
import { TRICKS, trickAt } from '../characters/tricks.js';

const DT = 1 / 120;
const SPAWN = [0, 96, -330];
const SPAWN_VEL = [0, 4, 24];
const RUN = { walk: 7, sprint: 14, accel: 10, turn: 2.6, jump: 10 };
const TRICK_TIME = 0.75;
const KEYS = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', Space: 'u', ShiftLeft: 's', ShiftRight: 's', KeyQ: 'q' };

export function createFreeSwing({ towers, camera, canvas, reduced, onMiss }) {
  let s = createSwinger(SPAWN, SPAWN_VEL, DT);
  let prevPos = [...SPAWN];
  let active = false;
  let holding = false;
  let acc = 0;
  let near = towersNear(towers, s.pos, 170);
  let nearTimer = 0;
  let fireTime = -1;
  let lastTry = -1;
  let heading = vNorm([SPAWN_VEL[0], 0, SPAWN_VEL[2]]);
  let trick = null; // { kind, t0 }
  let trickCount = 0;
  let landTime = -1;
  let gaitPhase = 0;
  let wasGrounded = false;
  let blocked = 0; // seconds spent pushing into a wall on foot
  let now = 0;
  const pointer = new THREE.Vector2(0, 0.25);
  const held = new Set();
  const ray = new THREE.Raycaster();
  const stats = { fired: 0, released: 0, misses: 0, distance: 0, maxSpeed: 0, tricks: 0, groundTime: 0, groundDistance: 0 };

  const aimDir = () => {
    ray.setFromCamera(pointer, camera);
    const d = ray.ray.direction;
    return vNorm([d.x, d.y + 0.6, d.z]); // bias upward: tethers go to rooftops, not the street
  };

  function fire(time) {
    const hit =
      pickAnchor(s.pos, aimDir(), near, { reach: 50, maxDist: 150, maxAngle: 1.2, minRise: 10 }) ||
      pickAnchor(s.pos, aimDir(), near, { reach: 55, maxDist: 160, maxAngle: 1.35 });
    if (!hit) {
      stats.misses++;
      onMiss?.();
      return;
    }
    s = attach(s, hit.point, 1.0);
    fireTime = time;
    trick = null;
    stats.fired++;
  }

  function startTrick(time) {
    if (trick || s.grounded || s.anchor) return;
    trick = { kind: TRICKS[trickCount++ % TRICKS.length], t0: time };
    stats.tricks++;
  }

  const setPointer = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (!active || e.button > 0 || e.target.closest?.('button, a, [data-ui]')) return;
      setPointer(e);
      holding = true;
      lastTry = -1;
      e.preventDefault();
    },
    { passive: false },
  );
  const onUp = () => {
    if (!active) return;
    holding = false;
    if (!s.anchor) return;
    const fast = vLen(velocity(s, DT)) > 20;
    s = release(s, DT, 3);
    stats.released++;
    if (fast && !reduced) startTrick(now);
  };
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('pointermove', (e) => active && setPointer(e));
  const onKey = (down) => (e) => {
    if (!active || !KEYS[e.code]) return;
    e.preventDefault();
    if (down) held.add(KEYS[e.code]);
    else held.delete(KEYS[e.code]);
    if (down && KEYS[e.code] === 'q' && !reduced) startTrick(now);
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));

  /** On foot: tank-style heading + target speed, blended into the Verlet velocity. */
  function groundMove(dt) {
    const turn = (held.has('r') ? 1 : 0) - (held.has('l') ? 1 : 0);
    if (turn) {
      const a = turn * RUN.turn * dt;
      heading = vNorm([heading[0] * Math.cos(a) - heading[2] * Math.sin(a), 0, heading[0] * Math.sin(a) + heading[2] * Math.cos(a)]);
    }
    const throttle = (held.has('f') ? 1 : 0) - (held.has('b') ? 0.6 : 0);
    const target = vScale(heading, throttle * (held.has('s') ? RUN.sprint : RUN.walk));
    const v = velocity(s, DT);
    // running head-first into a wall: ease the heading off it instead of stalling
    blocked = throttle > 0 && vLen([v[0], 0, v[2]]) < vLen(target) * 0.25 ? blocked + dt : 0;
    if (blocked > 0.3) {
      const a = 1.8 * dt;
      heading = vNorm([heading[0] * Math.cos(a) - heading[2] * Math.sin(a), 0, heading[0] * Math.sin(a) + heading[2] * Math.cos(a)]);
    }
    const k = 1 - Math.exp(-RUN.accel * dt);
    const nv = [v[0] + (target[0] - v[0]) * k, held.has('u') ? RUN.jump : 0, v[2] + (target[2] - v[2]) * k];
    s = { ...s, prev: vSub(s.pos, vScale(nv, DT)) };
  }

  function airControl() {
    const right = [-heading[2], 0, heading[0]];
    let c = [0, 0, 0];
    if (held.has('f')) c = vAdd(c, heading);
    if (held.has('b')) c = vSub(c, heading);
    if (held.has('r')) c = vAdd(c, right);
    if (held.has('l')) c = vSub(c, right);
    return vLen(c) > 0 ? vNorm(c) : c;
  }

  function simulate(dt, time) {
    acc += Math.min(dt, 0.1);
    while (acc >= DT) {
      acc -= DT;
      prevPos = s.pos;
      nearTimer -= DT;
      if (nearTimer <= 0) {
        near = towersNear(towers, s.pos, 170);
        nearTimer = 0.25;
      }
      const onFoot = s.grounded && !s.anchor;
      if (onFoot) groundMove(DT);
      const vy = velocity(s, DT)[1];
      const reel = Boolean(s.anchor) && s.ropeLength > 12;
      s = step(s, DT, { towers: near, control: s.grounded ? [0, 0, 0] : airControl(), reel, reelSpeed: 7, friction: !onFoot });
      if (s.grounded && !wasGrounded) {
        if (-vy > 7) landTime = time;
        trick = null;
      }
      wasGrounded = s.grounded;
    }
  }

  function heroPose(time, v) {
    const flat = [v[0], 0, v[2]];
    const flatSpeed = vLen(flat);
    if (!s.grounded && flatSpeed > 3) heading = vNorm(vLerp(heading, vNorm(flat), 0.05));
    if (s.anchor) {
      const shoot = 1 - smoothstep(0, 0.22, time - fireTime);
      const up = vNorm(vAdd(vScale(vNorm(vSub(s.anchor, s.pos)), 0.62), vScale(vNorm(v), 0.5)));
      return { weights: { swing: 1 - shoot * 0.7, shoot: shoot * 0.7 }, up, forward: vNorm(vAdd(vNorm(v), [0, -0.35, 0])) };
    }
    if (s.grounded) {
      const landing = landTime > 0 ? 1 - smoothstep(0, 0.35, time - landTime) : 0;
      const run = smoothstep(0.5, 3, flatSpeed);
      return {
        weights: { land: landing, run: run * (1 - landing), stand: (1 - run) * (1 - landing) },
        gait: run > 0 ? { phase: gaitPhase, amount: clamp(flatSpeed / RUN.sprint + 0.35, 0, 1) } : undefined,
        up: [0, 1, 0],
        forward: heading,
      };
    }
    const k = trick ? (time - trick.t0) / TRICK_TIME : -1;
    if (trick && k >= 1) trick = null;
    const t = trick ? trickAt(trick.kind, k, vNorm(v)) : null;
    const falling = smoothstep(0, -18, v[1]);
    return {
      weights: t ? t.weights : { dive: 0.4 + falling * 0.6, fly: 0.6 - falling * 0.6 },
      trick: t,
      up: vNorm(vAdd(vScale(vNorm(v), 0.45 + falling * 0.5), [0, 0.7 - falling * 0.55, 0])),
      forward: vNorm(vAdd(heading, [0, -0.6 - falling * 0.6, 0])),
    };
  }

  function chaseShot(pos, speed) {
    const k = reduced ? 0 : smoothstep(25, 55, speed);
    const onFoot = s.grounded ? 1 : 0;
    const back = 11 + k * 3 - onFoot * 4.5;
    const camPos = vAdd(vSub(pos, vScale(heading, back)), [0, 4.2 - onFoot * 1.6, 0]);
    const look = vAdd(vAdd(pos, vScale(heading, 10 - onFoot * 4)), [0, onFoot * 1.2, 0]);
    return { pos: [camPos[0], Math.max(camPos[1], 1.5), camPos[2]], look, fov: 60 + k * 16 - onFoot * 4, lag: reduced ? 0.3 : 0.16, collide: true, k };
  }

  return {
    stats,
    get active() {
      return active;
    },
    get attached() {
      return Boolean(s.anchor);
    },
    get grounded() {
      return s.grounded;
    },
    get position() {
      return [...s.pos];
    },
    enter() {
      s = createSwinger(SPAWN, SPAWN_VEL, DT);
      prevPos = [...SPAWN];
      heading = vNorm([SPAWN_VEL[0], 0, SPAWN_VEL[2]]);
      near = towersNear(towers, s.pos, 170);
      active = true;
      holding = false;
      trick = null;
    },
    exit() {
      active = false;
      holding = false;
      held.clear();
    },
    update(dt, ctx) {
      now = ctx.time;
      if (holding && !s.anchor && ctx.time - lastTry > 0.25) {
        lastTry = ctx.time;
        fire(ctx.time);
      }
      const before = s.pos;
      simulate(dt, ctx.time);
      // render between the last two physics states so motion is smooth at any refresh rate
      const pos = vLerp(prevPos, s.pos, acc / DT);
      const moved = vLen(vSub(s.pos, before));
      stats.distance += moved;
      const v = velocity(s, DT);
      const speed = vLen(v);
      stats.maxSpeed = Math.max(stats.maxSpeed, speed);
      if (s.grounded) {
        stats.groundTime += dt;
        stats.groundDistance += moved;
        gaitPhase += (vLen([v[0], 0, v[2]]) / 1.35) * dt * Math.PI;
      }

      const pose = heroPose(ctx.time, v);
      ctx.setHero(pos, pose.weights, { up: pose.up, forward: pose.forward, trick: pose.trick, gait: pose.gait, ground: s.grounded ? s.groundY : undefined });
      if (!pose.trick && !s.grounded) ctx.hero.flutter(smoothstep(20, 50, speed));
      ctx.hero.pulse(0.4 + smoothstep(20, 50, speed));
      if (s.anchor) ctx.tether(0, ctx.hero.hand(), s.anchor, { extend: clamp((ctx.time - fireTime) / 0.12), intensity: 1.2 });

      const shot = chaseShot(pos, speed);
      ctx.fx.lines = shot.k;
      ctx.fx.blur = shot.k * 0.45;
      ctx.wind = smoothstep(5, 55, speed);
      ctx.readout(speed * 3.6, pos[1]);
      ctx.shot(shot);
    },
  };
}
