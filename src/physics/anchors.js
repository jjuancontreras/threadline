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
