// FREE SWING: hold to fire a tether at the nearest building along the aim (the hand on that
// side throws it), release to let go (momentum preserved, auto-trick at speed).
// On foot: W walks, Shift runs (builds to a sprint), A/D turn; hold Space to crouch and charge a
// super jump (tap for a hop). E fires a line from each hand to the buildings either side and
// slingshots up and forward — or, next to a prop (crane pipe, lamp post), uses it instead.
// Q performs a trick in the air. Touch: tap-hold fires, lift releases; the pad drives press().
import * as THREE from 'three';
import { createSwinger, step, attach, release, velocity } from '../physics/swinger.js';
import { pickAnchor } from '../physics/anchors.js';
import { pickSlingPair, jumpSpeed, jumpCharge, leftOf, SLINGSHOT } from '../physics/sling.js';
import { towersNear } from '../core/layout.js';
import { vNorm, vAdd, vScale, vSub, vLen, vLerp, vDot, smoothstep, clamp, lerp } from '../core/math.js';
import { TRICKS, trickAt, TRICK_TIME } from '../characters/tricks.js';
import { gaitRate } from '../characters/poses.js';
import { slingMove, fadingLines } from './free/moves.js';

const DT = 1 / 120;
const SPAWN = [0, 96, -330];
const SPAWN_VEL = [0, 4, 24];
export const RUN = { walk: 4.2, sprint: 26, accelWalk: 5, accelSprint: 1.8, brake: 6, turn: 2.8, turnSprint: 1.5 };
const KEYS = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', Space: 'u', ShiftLeft: 's', ShiftRight: 's', KeyQ: 'q', KeyE: 'e' };

const rotateY = (h, a) => vNorm([h[0] * Math.cos(a) - h[2] * Math.sin(a), 0, h[0] * Math.sin(a) + h[2] * Math.cos(a)]);

/**
 * @param {{towers: object[], camera: THREE.Camera, canvas: HTMLElement, reduced: boolean,
 *   onMiss?: () => void, props?: {colliders: object[], actionNear?: Function}}} deps
 */
export function createFreeSwing({ towers, camera, canvas, reduced, onMiss, props = null }) {
  const world = props?.colliders?.length ? [...towers, ...props.colliders] : towers;
  let s = createSwinger(SPAWN, SPAWN_VEL, DT);
  let prevPos = [...SPAWN];
  let active = false;
  let holding = false;
  let acc = 0;
  let near = towersNear(world, s.pos, 170);
  let nearTimer = 0;
  let fireTime = -1;
  let lastTry = -1;
  let hand = 'R'; // which hand holds the current swing line
  let heading = vNorm([SPAWN_VEL[0], 0, SPAWN_VEL[2]]);
  let trick = null; // { kind, t0 }
  let trickCount = 0;
  let landTime = -1;
  let gaitPhase = 0;
  let wasGrounded = false;
  let blocked = 0; // seconds spent pushing into a wall on foot
  let now = 0;
  let charge = null; // { t0 } while Space is held on the ground
  let jumpReq = 0; // take-off speed waiting for the next physics step
  let jumpTime = -1;
  let jumpPeak = false;
  let move = null; // scripted move (slingshot, pipe, pole…)
  let fade = null;
  let lastMoveEnd = -1;
  const pointer = new THREE.Vector2(0, 0.25);
  const held = new Set();
  const ray = new THREE.Raycaster();
  const stats = { fired: 0, released: 0, misses: 0, distance: 0, maxSpeed: 0, tricks: 0, groundTime: 0, groundDistance: 0, slings: 0, jumps: 0, maxJump: 0, actions: 0 };

  const aimDir = () => {
    ray.setFromCamera(pointer, camera);
    const d = ray.ray.direction;
    return vNorm([d.x, d.y + 0.6, d.z]); // bias upward: tethers go to rooftops, not the street
  };

  /** Throw a swing line along the aim; the hand on the anchor's side throws it. */
  function fire(time) {
    const hit =
      pickAnchor(s.pos, aimDir(), near, { reach: 50, maxDist: 150, maxAngle: 1.2, minRise: 10 }) ||
      pickAnchor(s.pos, aimDir(), near, { reach: 55, maxDist: 160, maxAngle: 1.35 });
    if (!hit) {
      stats.misses++;
      onMiss?.();
      return;
    }
    hand = vDot(vSub(hit.point, s.pos), leftOf(heading)) > 0 ? 'L' : 'R';
    s = attach(s, hit.point, 1.0);
    fireTime = time;
    trick = null;
    charge = null;
    stats.fired++;
  }

  function startTrick(time, kind) {
    if (trick || s.grounded || s.anchor || move) return;
    trick = { kind: kind || TRICKS[trickCount++ % TRICKS.length], t0: time };
    stats.tricks++;
  }

  /** Let go of the line (momentum kept); a fast release earns an automatic trick. */
  function letGo() {
    if (!s.anchor) return;
    const fast = vLen(velocity(s, DT)) > 20;
    s = release(s, DT, 3);
    stats.released++;
    if (fast && !reduced) startTrick(now);
  }

  /** E: a nearby prop's action if there is one, otherwise the two-handed slingshot. */
  function action() {
    if (move || now - lastMoveEnd < SLINGSHOT.cooldown) return;
    const prop = props?.actionNear?.(s.pos, heading, velocity(s, DT));
    if (prop) {
      move = prop.start(s.pos, velocity(s, DT));
      stats.actions++;
    } else {
      const pair = pickSlingPair(s.pos, heading, near);
      if (!pair) {
        stats.misses++;
        onMiss?.();
        return;
      }
      move = slingMove(s.pos, heading, pair, velocity(s, DT), s.grounded ? s.groundY : null);
      stats.slings++;
    }
    if (s.anchor) s = release(s, DT, 0);
    trick = null;
    charge = null;
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
    letGo();
  };
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('pointermove', (e) => active && setPointer(e));

  /** Press/release one control ('f','b','l','r','u','s','q','e'); shared by keyboard and touch pad. */
  function press(key, down) {
    if (!active) return;
    const was = held.has(key);
    if (down) held.add(key);
    else held.delete(key);
    if (down && !was && key === 'q' && !reduced) startTrick(now);
    if (down && !was && key === 'e') action();
    if (key === 'u' && down && !was && s.grounded && !s.anchor && !move) charge = { t0: now };
    if (key === 'u' && !down && charge) {
      jumpReq = jumpSpeed(now - charge.t0);
      charge = null;
    }
  }
  const onKey = (down) => (e) => {
    if (!active || !KEYS[e.code]) return;
    e.preventDefault();
    if (e.repeat) return;
    press(KEYS[e.code], down);
  };
  window.addEventListener('keydown', onKey(true));
  window.addEventListener('keyup', onKey(false));

  const chargeK = () => (charge ? jumpCharge(now - charge.t0) : 0);

  /** On foot: tank-style heading + target speed with momentum, blended into the Verlet velocity. */
  function groundMove(dt) {
    const v = velocity(s, DT);
    const flat = vLen([v[0], 0, v[2]]);
    const turn = (held.has('r') ? 1 : 0) - (held.has('l') ? 1 : 0);
    if (turn) heading = rotateY(heading, turn * lerp(RUN.turn, RUN.turnSprint, smoothstep(8, RUN.sprint, flat)) * dt);
    const sprint = held.has('s');
    const throttle = (held.has('f') ? 1 : 0) - (held.has('b') ? 0.45 : 0);
    const top = (sprint ? RUN.sprint : RUN.walk) * (1 - chargeK() * 0.9);
    const target = vScale(heading, throttle * top);
    // running head-first into a wall: ease the heading off it instead of stalling
    blocked = throttle > 0 && flat < vLen(target) * 0.25 ? blocked + dt : 0;
    if (blocked > 0.3) heading = rotateY(heading, 1.8 * dt);
    const rate = vLen(target) > flat ? (sprint ? RUN.accelSprint : RUN.accelWalk) : RUN.brake;
    const k = 1 - Math.exp(-rate * dt);
    let vy = 0;
    if (jumpReq > 0) {
      vy = jumpReq;
      stats.jumps++;
      stats.maxJump = Math.max(stats.maxJump, jumpReq);
      jumpTime = now;
      jumpPeak = jumpReq > 24;
      jumpReq = 0;
    }
    const nv = [v[0] + (target[0] - v[0]) * k, vy, v[2] + (target[2] - v[2]) * k];
    s = { ...s, prev: vSub(s.pos, vScale(nv, DT)) };
  }

  function airControl() {
    const right = vScale(leftOf(heading), -1);
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
        near = towersNear(world, s.pos, 170);
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
      if (!s.grounded) charge = null; // walked off an edge mid-charge
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
      const [sw, sh] = hand === 'L' ? ['swingL', 'shootL'] : ['swing', 'shoot'];
      return { weights: { [sw]: 1 - shoot * 0.7, [sh]: shoot * 0.7 }, up, forward: vNorm(vAdd(vNorm(v), [0, -0.35, 0])) };
    }
    if (s.grounded) {
      const landing = landTime > 0 ? 1 - smoothstep(0, 0.35, time - landTime) : 0;
      const ch = smoothstep(0, 0.25, charge ? time - charge.t0 : 0);
      const moving = smoothstep(0.2, 1.6, flatSpeed) * (1 - ch);
      const run = smoothstep(5, 13, flatSpeed);
      const rest = (1 - landing) * (1 - ch);
      return {
        weights: { land: landing * (1 - ch), charge: ch, walk: moving * (1 - run) * rest, run: moving * run * rest, stand: (1 - moving) * rest },
        gait: moving > 0 ? { phase: gaitPhase, amount: moving, run } : undefined,
        up: [0, 1, 0],
        forward: heading,
      };
    }
    const k = trick ? (time - trick.t0) / TRICK_TIME[trick.kind] : -1;
    if (trick && k >= 1) trick = null;
    const t = trick ? trickAt(trick.kind, k, vNorm(v)) : null;
    if (t) return { weights: t.weights, trick: t, up: [0, 1, 0], forward: heading };
    // just jumped: stay upright, knees drawn up, opening out toward the apex
    if (time - jumpTime < 1.6 && v[1] > -6) {
      const rise = clamp(v[1] / 30);
      return { weights: { tuck: 0.2 + rise * 0.35, spread: 0.45 * (1 - rise), fly: 0.35 }, up: vNorm([heading[0] * 0.15, 1, heading[2] * 0.15]), forward: heading };
    }
    const falling = smoothstep(0, -18, v[1]);
    return {
      weights: { dive: 0.4 + falling * 0.6, fly: 0.6 - falling * 0.6 },
      up: vNorm(vAdd(vScale(vNorm(v), 0.45 + falling * 0.5), [0, 0.7 - falling * 0.55, 0])),
      forward: vNorm(vAdd(heading, [0, -0.6 - falling * 0.6, 0])),
    };
  }

  function chaseShot(pos, speed) {
    const k = reduced ? 0 : smoothstep(25, 55, speed);
    const onFoot = s.grounded ? 1 : 0;
    const ch = chargeK();
    const run = onFoot * smoothstep(8, RUN.sprint, speed);
    const back = 11 + k * 3 - onFoot * 4.5 + run * 2.5 - ch * 1.5;
    const camPos = vAdd(vSub(pos, vScale(heading, back)), [0, 4.2 - onFoot * 1.6 - ch * 1.2, 0]);
    const look = vAdd(vAdd(pos, vScale(heading, 10 - onFoot * 4)), [0, onFoot * 1.2, 0]);
    const fov = 60 + k * 16 - onFoot * 4 + run * 10;
    return { pos: [camPos[0], Math.max(camPos[1], 1.5), camPos[2]], look, fov, lag: reduced ? 0.3 : 0.16, collide: true, k: Math.max(k, run * 0.6) };
  }

  /** Run the active scripted move; hand back to physics when it finishes. */
  function stepMove(dt, ctx) {
    const f = move.step(dt, ctx);
    if (f.done) {
      const exit = f.exit;
      s = { ...createSwinger(exit.pos, exit.vel, DT), grounded: false };
      prevPos = exit.pos;
      acc = 0;
      if (f.lines?.length) fade = fadingLines(f.lines.map((l) => ({ ...l, strain: 0 })));
      if (move.kind === 'sling' && !reduced) trick = { kind: 'launch', t0: now };
      lastMoveEnd = now;
      move = null;
      wasGrounded = false;
      jumpTime = -1;
    }
    return f;
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
      return s.grounded && !move;
    },
    get position() {
      return [...s.pos];
    },
    get moving() {
      return move?.kind ?? null;
    },
    get charging() {
      return chargeK();
    },
    press,
    enter() {
      s = createSwinger(SPAWN, SPAWN_VEL, DT);
      prevPos = [...SPAWN];
      heading = vNorm([SPAWN_VEL[0], 0, SPAWN_VEL[2]]);
      near = towersNear(world, s.pos, 170);
      active = true;
      holding = false;
      trick = null;
      move = null;
      charge = null;
    },
    exit() {
      active = false;
      holding = false;
      move = null;
      charge = null;
      held.clear();
    },
    update(dt, ctx) {
      now = ctx.time;
      if (move) {
        const f = stepMove(dt, ctx);
        if (move || !f.done) {
          ctx.setHero(f.pos, f.weights, { up: f.up, forward: f.forward, trick: f.trick, ground: f.ground });
          ctx.hero.pulse(0.9);
          (f.lines || []).forEach((l, i) => ctx.tether(i, ctx.hero.hand(l.hand), l.to, { extend: l.extend, strain: l.strain, intensity: l.intensity }));
          if (f.shake) ctx.shake.hold(f.shake);
          ctx.readout(0, f.pos[1]);
          ctx.wind = 0.3;
          ctx.shot(f.shot || chaseShot(f.pos, 0));
          return;
        }
      }
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
        gaitPhase += gaitRate(vLen([v[0], 0, v[2]])) * dt;
      }
      // a big jump earns a trick at the top of the arc
      if (jumpPeak && !s.grounded && v[1] < 2 && !reduced) {
        jumpPeak = false;
        startTrick(now);
      }

      const pose = heroPose(ctx.time, v);
      ctx.setHero(pos, pose.weights, { up: pose.up, forward: pose.forward, trick: pose.trick, gait: pose.gait, ground: s.grounded ? s.groundY : undefined });
      if (!pose.trick && !s.grounded) ctx.hero.flutter(smoothstep(20, 50, speed));
      ctx.hero.pulse(0.4 + smoothstep(20, 50, speed) + chargeK() * 0.8);
      if (s.anchor) ctx.tether(0, ctx.hero.hand(hand), s.anchor, { extend: clamp((ctx.time - fireTime) / 0.12), intensity: 1.2 });
      const ch = chargeK();
      if (ch > 0) ctx.shake.hold(0.05 + ch * 0.3);
      if (fade) {
        const lines = fade.step(dt, (h) => ctx.hero.hand(h));
        if (!lines) fade = null;
        else lines.forEach((l, i) => ctx.tether(i + 1, l.from, l.to, { extend: 1, strain: 0, intensity: l.intensity }));
      }

      const shot = chaseShot(pos, speed);
      ctx.fx.lines = shot.k;
      ctx.fx.blur = shot.k * 0.45;
      ctx.wind = smoothstep(5, 55, speed);
      ctx.readout(speed * 3.6, pos[1]);
      ctx.shot(shot);
    },
  };
}
