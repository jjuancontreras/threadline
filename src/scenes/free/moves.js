// Scripted free-mode moves: short, authored motions that take the hero out of the physics
// simulation and hand it back with an exit velocity. Each move is
//   step(dt) → { pos, weights, up, forward, trick?, lines:[{hand, to, extend, strain, intensity}],
//                shake, done, exit?: { pos, vel } }
import { vAdd, vSub, vScale, vNorm, vLerp, vDist, smoothstep, clamp } from '../../core/math.js';
import { SLINGSHOT, slingPhase, slingLaunch } from '../../physics/sling.js';

export const PIPE = { length: 26, speed: 40, exitSpeed: 40, exitLift: 9 };
export const POLE = { radius: 1.35, grab: 0.14, whirl: 0.62, climb: 2.2, exitSpeed: 30, exitLift: 17 };

/**
 * Two-handed web slingshot: a line to a building on each side, a bowstring stretch back,
 * then a launch up and forward.
 */
/** @param groundY world Y of the surface the hero stands on, or null when airborne */
export function slingMove(start, heading, pair, carried, groundY) {
  let t = 0;
  const launch = slingLaunch(start, heading, pair, carried);
  const grounded = groundY !== null && groundY !== undefined;
  return {
    kind: 'sling',
    pair,
    step(dt) {
      t += dt;
      const ph = slingPhase(t);
      // the crouch comes from the pose (feet stay planted via `ground`); the body is never pushed
      // below the street, where the floor collision would eat the launch's vertical velocity
      const pos = vAdd(start, vScale(heading, -SLINGSHOT.pullBack * ph.stretch));
      const aim = smoothstep(0, 1, ph.extend);
      const weights = ph.phase === 'fire'
        ? { pull: aim, [grounded ? 'stand' : 'fly']: 1 - aim }
        : { pull: 1 - ph.stretch * 0.35, crouch: ph.stretch * (grounded ? 0.45 : 0.1), brace: ph.stretch * 0.25 };
      const lines = ['L', 'R'].map((hand) => ({ hand, to: pair[hand], extend: ph.extend, strain: ph.stretch, intensity: 1.15 + ph.stretch * 0.5 }));
      const lean = vNorm(vAdd([0, 1, 0], vScale(heading, -0.25 * ph.stretch))); // lean back into the lines
      const out = { pos, weights, up: lean, forward: heading, lines, shake: 0.06 + ph.stretch * 0.14, done: false, ground: grounded ? groundY : undefined };
      if (ph.phase === 'launch') {
        out.done = true;
        out.exit = { pos, vel: launch };
      }
      return out;
    },
  };
}

/** Tether end-points that linger and fade for a moment after a move lets go (the "snap"). */
export function fadingLines(lines, duration = 0.2) {
  let t = 0;
  return {
    step(dt, handPos) {
      t += dt;
      const k = 1 - t / duration;
      if (k <= 0) return null;
      return lines.map((l) => ({ ...l, from: handPos(l.hand), intensity: l.intensity * k, extend: 1 }));
    },
  };
}


const easeInOut = (u) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u));

/**
 * Crane pipe run: zip on a web line to the nearer mouth, shoot through the tube (a slow roll
 * inside, camera following down the bore), and fly out of the far end.
 * @param {() => {a:number[], b:number[], axis:number[]}} ends live pipe mouths (the pipe sways)
 */
export function pipeMove(start, ends) {
  const e0 = ends();
  const nearA = vDist(start, e0.a) <= vDist(start, e0.b);
  const zipTime = clamp(vDist(start, nearA ? e0.a : e0.b) / 45, 0.22, 0.45);
  const tubeTime = PIPE.length / PIPE.speed;
  let t = 0;
  return {
    kind: 'pipe',
    step(dt) {
      t += dt;
      const e = ends();
      const [entry, exit] = nearA ? [e.a, e.b] : [e.b, e.a];
      const dir = vNorm(vSub(exit, entry));
      const mouth = vSub(entry, vScale(dir, 1.2)); // hover just outside the rim before diving in
      if (t < zipTime) {
        const u = easeInOut(t / zipTime);
        const arc = Math.sin(u * Math.PI) * 3;
        const pos = vAdd(vLerp(start, mouth, u), [0, arc, 0]);
        const aim = vNorm(vSub(mouth, pos));
        return {
          pos,
          weights: { shoot: 1 - u * 0.6, dive: u * 0.6 },
          up: vNorm(vAdd(aim, [0, 0.4, 0])),
          forward: vNorm(vAdd(aim, [0, -0.3, 0])),
          lines: [{ hand: 'R', to: entry, extend: clamp(t / 0.1), strain: 0.3, intensity: 1.3 }],
          shake: 0,
          done: false,
          shot: { pos: vAdd(vSub(pos, vScale(aim, 9)), [0, 2.5, 0]), look: entry, fov: 64, lag: 0.12 },
        };
      }
      const u = (t - zipTime) / tubeTime;
      const k = easeInOut(u) * 0.35 + u * 0.65; // mostly constant speed, eased in and out
      const pos = vLerp(mouth, vAdd(exit, vScale(dir, 1.2)), clamp(k));
      const roll = u * Math.PI * 2;
      const side = vNorm([-dir[2], 0, dir[0]]);
      const up = vNorm(vAdd(vScale([0, 1, 0], Math.cos(roll)), vScale(side, Math.sin(roll)))); // corkscrew down the bore
      const out = {
        pos,
        weights: { dive: 0.7, spread: 0.3 },
        up: vNorm(vAdd(vScale(dir, 0.9), vScale(up, 0.45))),
        forward: vNorm(vAdd(vScale(up, -1), vScale(dir, 0.2))),
        lines: [],
        shake: 0.05,
        done: false,
        shot: { pos: vSub(pos, vScale(dir, 6.5)), look: vAdd(pos, vScale(dir, 10)), fov: 78, lag: 0.05, cut: t - zipTime < 0.02 },
      };
      if (u >= 1) {
        out.done = true;
        out.exit = { pos: vAdd(exit, vScale(dir, 1.5)), vel: vAdd(vScale(dir, PIPE.exitSpeed), [0, PIPE.exitLift, 0]) };
      }
      return out;
    },
  };
}

/**
 * Pole whirl: grab a lamp post / antenna mast one-handed, swing around it about 1¼ turns while
 * spiralling up, and let go on the tangent that points along the heading.
 */
export function poleMove(start, heading, pole) {
  const center = [pole.x, 0, pole.z];
  const grabY = clamp(start[1] + 0.5, pole.base + 1.6, pole.top - 1.2);
  const rel = [start[0] - pole.x, start[2] - pole.z];
  const a0 = Math.atan2(rel[1], rel[0]);
  // spin direction: keep the current sense of motion around the pole
  const dir = rel[0] * heading[2] - rel[1] * heading[0] > 0 ? 1 : -1;
  // end on the angle whose tangent points along the heading, 1..1.5 turns later
  const aEnd0 = Math.atan2(-dir * heading[0], dir * heading[2]);
  let sweep = dir * (aEnd0 - a0);
  while (sweep < Math.PI * 2) sweep += Math.PI * 2;
  while (sweep > Math.PI * 3) sweep -= Math.PI * 2;
  const R = POLE.radius;
  let t = 0;
  const at = (a, y) => [pole.x + Math.cos(a) * R, y, pole.z + Math.sin(a) * R];
  return {
    kind: 'pole',
    step(dt) {
      t += dt;
      if (t < POLE.grab) {
        const u = easeInOut(t / POLE.grab);
        const pos = vLerp(start, at(a0, grabY), u);
        return { pos, weights: { shoot: 1 - u, swing: u }, up: [0, 1, 0], forward: vNorm(vSub(center.map((v, i) => (i === 1 ? pos[1] : v)), pos)), lines: [], shake: 0, done: false };
      }
      const u = clamp((t - POLE.grab) / POLE.whirl);
      const e = u * u * (1.6 - 0.6 * u); // accelerate into the swing
      const a = a0 + dir * sweep * e;
      const y = grabY + POLE.climb * e;
      const pos = at(a, y);
      const toPole = vNorm([pole.x - pos[0], 0, pole.z - pos[2]]);
      const tangent = [-Math.sin(a) * dir, 0, Math.cos(a) * dir];
      // body leans out from the pole, feet flung around the arc
      const out = {
        pos,
        weights: { swing: 0.75, spread: 0.25 },
        up: vNorm(vAdd(vScale(toPole, 0.9), [0, 0.55 - u * 0.25, 0])),
        forward: tangent,
        lines: [],
        shake: 0.04 + u * 0.08,
        done: false,
        grip: [pole.x, y + 0.6, pole.z],
      };
      if (u >= 1) {
        out.done = true;
        out.exit = { pos, vel: vAdd(vScale(tangent, POLE.exitSpeed), [0, POLE.exitLift, 0]) };
      }
      return out;
    },
  };
}
