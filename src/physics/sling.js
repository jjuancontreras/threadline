// Free-mode movement physics that is not rope swinging: the two-handed web slingshot
// (a line to a building on each side, stretched back like a bowstring, then fired up and
// forward) and the charged super jump. Pure functions; the free-swing controller drives them.
import { vAdd, vSub, vScale, vNorm, vLen, vDot, smoothstep, clamp, lerp } from '../core/math.js';
import { closestOnTower } from './anchors.js';
import { towersNear } from '../core/layout.js';

export const SLINGSHOT = {
  fire: 0.16, // s — both lines fly out
  load: 0.42, // s — stretched back against the lines
  reach: 150, // m — how far a line can reach
  aimAhead: 30, // m — ideal anchor: ahead of the hero…
  aimSide: 26, // …out to each side…
  aimUp: 22, // …and above
  pullBack: 3.2, // m pulled back at full stretch
  speed: 42, // m/s launch speed
  upBias: 0.78, // launch pitch (0 = flat, 1 = 45°)
  carry: 0.35, // share of the previous horizontal velocity kept
  cooldown: 0.5,
};

export const JUMP = {
  tap: 14, // m/s — a quick hop (≈ 6 m high at gravity 17)
  max: 40, // m/s — fully charged (≈ 47 m high)
  fullCharge: 1.1, // s of holding to reach max
  tapWindow: 0.14, // releases faster than this are a plain hop
};

/** Left of a flat heading (character convention: +X is the left of a +Z-facing body). */
export const leftOf = (h) => vNorm([h[2], 0, -h[0]]);

function bestOnSide(pos, heading, side, towers, relaxed) {
  const target = vAdd(vAdd(vAdd(pos, vScale(heading, SLINGSHOT.aimAhead)), vScale(side, SLINGSHOT.aimSide)), [0, SLINGSHOT.aimUp, 0]);
  let best = null;
  let bestScore = Infinity;
  for (const t of towers) {
    const c = closestOnTower(t, target);
    const point = [c[0], Math.min(c[1], t.h - 0.5), c[2]];
    const to = vSub(point, pos);
    const dist = vLen(to);
    if (dist < 6 || dist > SLINGSHOT.reach) continue;
    if (vDot(to, side) < (relaxed ? 1 : 4)) continue; // must be on this side
    if (vDot(to, heading) < (relaxed ? -40 : -4)) continue; // not (far) behind
    if (point[1] < pos[1] + (relaxed ? 1 : 3)) continue; // must be above
    const score = vLen(vSub(point, target));
    if (score < bestScore) {
      bestScore = score;
      best = point;
    }
  }
  return best;
}

/**
 * One anchor on a building to the left and one to the right of the heading.
 * @param {number[]} pos hero position
 * @param {number[]} heading flat, normalized travel direction
 * @param {object[]} towers
 * @returns {{L:number[], R:number[]}|null} null when either side has nothing to grab
 */
export function pickSlingPair(pos, heading, towers) {
  const near = towersNear(towers, pos, SLINGSHOT.reach);
  const left = leftOf(heading);
  const right = vScale(left, -1);
  const L = bestOnSide(pos, heading, left, near, false) || bestOnSide(pos, heading, left, near, true);
  const R = bestOnSide(pos, heading, right, near, false) || bestOnSide(pos, heading, right, near, true);
  return L && R ? { L, R } : null;
}

/**
 * Where the slingshot is at time t since firing.
 * @returns {{phase:'fire'|'load'|'launch', extend:number, stretch:number}}
 *   extend 0..1 line flight; stretch 0..1 how far the hero is drawn back
 */
export function slingPhase(t) {
  if (t < SLINGSHOT.fire) return { phase: 'fire', extend: clamp(t / SLINGSHOT.fire), stretch: 0 };
  const k = (t - SLINGSHOT.fire) / SLINGSHOT.load;
  if (k < 1) return { phase: 'load', extend: 1, stretch: smoothstep(0, 1, k) };
  return { phase: 'launch', extend: 1, stretch: 1 };
}

/** Launch velocity: up and forward along the heading, tilted toward the anchors' height. */
export function slingLaunch(pos, heading, pair, carried = [0, 0, 0]) {
  const mid = vScale(vAdd(pair.L, pair.R), 0.5);
  const lift = clamp((mid[1] - pos[1]) / 40, 0, 1); // high anchors fling you higher
  const dir = vNorm(vAdd(heading, [0, SLINGSHOT.upBias + lift * 0.35, 0]));
  const keep = vScale([carried[0], 0, carried[2]], SLINGSHOT.carry);
  return vAdd(vScale(dir, SLINGSHOT.speed), keep);
}

/** Vertical take-off speed for a jump held for `held` seconds (tap → hop, long hold → super jump). */
export function jumpSpeed(held) {
  if (held < JUMP.tapWindow) return JUMP.tap;
  const k = clamp((held - JUMP.tapWindow) / (JUMP.fullCharge - JUMP.tapWindow));
  return lerp(JUMP.tap, JUMP.max, 1 - (1 - k) * (1 - k)); // ease-out: early holding pays off most
}

/** 0..1 charge for UI/pose/shake. */
export const jumpCharge = (held) => clamp(held / JUMP.fullCharge);
