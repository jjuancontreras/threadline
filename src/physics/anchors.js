// Tether targeting: find the best facade point on a real tower along the aim direction.
import { vSub, vLen, vDot, vNorm, vAdd, vScale } from '../core/math.js';
import { towersNear } from '../core/layout.js';

export const AIM = { reach: 60, maxDist: 150, minDist: 8, minRise: 3, maxAngle: 1.05 };

/** Closest point on a tower's surface (walls + roof) to point p. */
export function closestOnTower(t, p) {
  const c = [
    Math.min(Math.max(p[0], t.x - t.w), t.x + t.w),
    Math.min(Math.max(p[1], 0), t.h),
    Math.min(Math.max(p[2], t.z - t.d), t.z + t.d),
  ];
  const inside = c[0] === p[0] && c[1] === p[1] && c[2] === p[2];
  if (!inside) return c;
  // p is inside: push to nearest face
  const dx = t.w - Math.abs(p[0] - t.x);
  const dz = t.d - Math.abs(p[2] - t.z);
  const dy = t.h - p[1];
  if (dy < dx && dy < dz) return [p[0], t.h, p[2]];
  if (dx < dz) return [t.x + Math.sign(p[0] - t.x || 1) * t.w, p[1], p[2]];
  return [p[0], p[1], t.z + Math.sign(p[2] - t.z || 1) * t.d];
}

/**
 * @param {number[]} hero hero position
 * @param {number[]} aim normalized aim direction
 * @param {object[]} towers tower list
 * @returns {{point:number[], tower:object}|null}
 */
export function pickAnchor(hero, aim, towers, opts = {}) {
  const cfg = { ...AIM, ...opts };
  const dir = vNorm(aim);
  const target = vAdd(hero, vScale(dir, cfg.reach));
  let best = null;
  let bestScore = Infinity;
  for (const t of towersNear(towers, hero, cfg.maxDist)) {
    const c = closestOnTower(t, target);
    // keep anchors a little below the roof edge so tethers read as "on the building"
    const point = [c[0], Math.min(c[1], t.h - 0.5), c[2]];
    const to = vSub(point, hero);
    const dist = vLen(to);
    if (dist < cfg.minDist || dist > cfg.maxDist) continue;
    if (point[1] < hero[1] + cfg.minRise) continue;
    const angle = Math.acos(Math.min(1, Math.max(-1, vDot(vScale(to, 1 / dist), dir))));
    if (angle > cfg.maxAngle) continue;
    if (cfg.minClearance !== undefined && point[1] - dist < cfg.minClearance) continue;
    const miss = vLen(vSub(point, target));
    const score = angle * 1.2 + miss / cfg.reach;
    if (score < bestScore) {
      bestScore = score;
      best = { point, tower: t };
    }
  }
  return best;
}

export const AUTO = {
  ahead: [16, 36], // m ahead of the hero (grows with speed)
  up: [20, 30], // m above
  lateral: 12, // m out to the side: swings hang off the buildings flanking the path
  minRise: 7,
  minRope: 12,
  maxRope: 80,
  groundClear: 2.5,
};

/**
 * Auto-targeted swing anchor (Insomniac-style): the player only says where they want to go;
 * the line lands on a real facade ahead of and above them, off to whichever side has a building,
 * with the arc's low point kept clear of the street when they are high enough to care.
 * @param {number[]} pos hero position
 * @param {number[]} vel hero velocity
 * @param {number[]} desired flat unit direction the player wants to travel
 * @param {object[]} towers
 * @returns {{point:number[], tower:object, side:'L'|'R'}|null}
 */
export function pickSwingAnchor(pos, vel, desired, towers) {
  const speed = Math.hypot(vel[0], vel[2]);
  const ahead = Math.min(Math.max(12 + speed * 0.55, AUTO.ahead[0]), AUTO.ahead[1]);
  const up = Math.min(Math.max(20 + speed * 0.15, AUTO.up[0]), AUTO.up[1]);
  const left = vNorm([desired[2], 0, -desired[0]]);
  const near = towersNear(towers, pos, AUTO.maxRope + 20);
  let best = null;
  let bestScore = Infinity;
  for (const side of [1, -1]) {
    const target = vAdd(vAdd(vAdd(pos, vScale(desired, ahead)), vScale(left, side * AUTO.lateral)), [0, up, 0]);
    for (const t of near) {
      const c = closestOnTower(t, target);
      const point = [c[0], Math.min(c[1], t.h - 0.5), c[2]];
      const to = vSub(point, pos);
      const dist = vLen(to);
      if (dist < AUTO.minRope || dist > AUTO.maxRope) continue;
      if (point[1] < pos[1] + AUTO.minRise) continue;
      const fwd = to[0] * desired[0] + to[2] * desired[2];
      if (fwd < 3) continue; // never behind or beside: the arc has to carry you forward
      // bottom of the arc: scraping the street is fine when starting low, bad when already high
      const scrape = pos[1] > 12 && point[1] - dist < AUTO.groundClear ? 1.5 : 0;
      const score = vLen(vSub(point, target)) / ahead + scrape - Math.min(fwd, ahead) / ahead * 0.3;
      if (score < bestScore) {
        bestScore = score;
        best = { point, tower: t, side: side > 0 ? 'L' : 'R' };
      }
    }
  }
  return best;
}

/**
 * Where the player wants to go, from the movement keys relative to the current heading.
 * @param {number[]} heading flat unit heading
 * @param {{f:boolean, b:boolean, l:boolean, r:boolean}} keys
 * @param {number[]} vel current velocity (used when no key is held)
 */
export function desiredDirection(heading, keys, vel) {
  const left = [heading[2], 0, -heading[0]];
  let x = 0;
  let z = 0;
  const add = (v, k) => {
    x += v[0] * k;
    z += v[2] * k;
  };
  if (keys.f) add(heading, 1);
  if (keys.b) add(heading, -0.6);
  if (keys.l) add(left, 0.8);
  if (keys.r) add(left, -0.8);
  if (Math.hypot(x, z) < 1e-3) {
    const flat = Math.hypot(vel[0], vel[2]);
    return flat > 2 ? [vel[0] / flat, 0, vel[2] / flat] : heading;
  }
  const len = Math.hypot(x, z);
  return [x / len, 0, z / len];
}
