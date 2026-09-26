// Chapter 5 rescue: train braking model. Pure + immutable so it is unit-testable.
// Guarantee: whatever the user does, the nose stops exactly `margin` short of the edge.

export const RESCUE = {
  startSpeed: 18, // m/s
  baseDecel: 0.35, // emergency brakes alone (not enough)
  perAnchorDecel: 1.25,
  autoAfter: 6, // seconds before anchors start auto-firing
  autoInterval: 0.45,
  criticalDecel: 5.5, // if stopping would need more than this, auto-fire now
  anchors: 4,
};

export function createRescue(noseX, edgeX, margin) {
  return {
    x: noseX,
    v: RESCUE.startSpeed,
    edge: edgeX,
    margin,
    t: 0,
    anchored: Array(RESCUE.anchors).fill(false),
    fired: [], // {index, t, auto}
    lastAuto: -Infinity,
    saved: false,
  };
}

export const anchoredCount = (r) => r.anchored.filter(Boolean).length;
const remaining = (r) => r.edge - r.margin - r.x;

/** Fire tether at anchor i (user action). No-op if already anchored or saved. */
export function fireAnchor(r, i, auto = false) {
  if (r.saved || r.anchored[i]) return r;
  const anchored = r.anchored.map((a, k) => (k === i ? true : a));
  return { ...r, anchored, fired: [...r.fired, { index: i, t: r.t, auto }] };
}

function autoFire(r) {
  const d = remaining(r);
  const needed = (r.v * r.v) / (2 * Math.max(d, 0.01));
  const late = r.t > RESCUE.autoAfter || needed > RESCUE.criticalDecel;
  if (!late || r.t - r.lastAuto < RESCUE.autoInterval) return r;
  const next = r.anchored.indexOf(false);
  if (next < 0) return r;
  return { ...fireAnchor(r, next, true), lastAuto: r.t };
}

/** Advance the rescue by dt seconds. */
export function stepRescue(r, dt) {
  if (r.saved) return r;
  let s = autoFire({ ...r, t: r.t + dt });
  const n = anchoredCount(s);
  const d = remaining(s);
  let a = RESCUE.baseDecel + n * RESCUE.perAnchorDecel;
  if (n === RESCUE.anchors) a = (s.v * s.v) / (2 * Math.max(d, 1e-4)); // exact stop
  const v = Math.max(0, s.v - a * dt);
  let x = s.x + ((s.v + v) / 2) * dt;
  const stopX = s.edge - s.margin;
  if (x >= stopX || (n === RESCUE.anchors && (v < 0.03 || stopX - x < 0.004))) {
    return { ...s, x: stopX, v: 0, saved: true };
  }
  return { ...s, x, v };
}

/** 0..1 strain per anchor for visuals (how hard the tether is pulling). */
export function strain(r) {
  const n = Math.max(anchoredCount(r), 1);
  return Math.min(1, (r.v / RESCUE.startSpeed) * (4 / n) * 0.6 + (r.saved ? 0 : 0.2));
}
