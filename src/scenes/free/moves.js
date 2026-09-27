// Scripted free-mode moves: short, authored motions that take the hero out of the physics
// simulation and hand it back with an exit velocity. Each move is
//   step(dt) → { pos, weights, up, forward, trick?, lines:[{hand, to, extend, strain, intensity}],
//                shake, done, exit?: { pos, vel } }
import { vAdd, vScale, vNorm, smoothstep } from '../../core/math.js';
import { SLINGSHOT, slingPhase, slingLaunch } from '../../physics/sling.js';

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

