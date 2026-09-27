// Wall running on building faces (pure). The hero stands "on" a facade — up = the face normal —
// and moves in the face plane: W/S climb and descend, A/D strafe along the face, Shift runs.
// Running past a vertical edge wraps around the corner onto the next face; climbing past the
// roof line vaults onto the roof; reaching the street steps off. A glancing, fast contact turns
// into a horizontal wall-run that carries the along-wall speed.
import { clamp } from '../core/math.js';

export const WALL = {
  crawl: 6, // m/s
  run: 18, // m/s with Shift
  accel: 7, // 1/s approach rate toward the target speed
  hRunMin: 10, // m/s along the wall on contact → horizontal wall-run
  hRunKeep: 20, // horizontal wall-run cruising speed
  hRunSink: 1.2, // m/s the hero sags while running sideways
  standOff: 0.7, // physics body distance from the facade (collision radius)
  vaultIn: 1.6, // m onto the roof when vaulting over the ledge
  jump: { out: 14, up: 13, carry: 0.6 },
};

/** Face basis: normal n (horizontal, unit), right = the direction that is "right" when facing the wall. */
export const faceRight = (n) => [n[2] + 0, 0, 0 - n[0]];

/** Which face of a box tower a point is outside of (the side it was pushed out of). */
export function faceNormal(t, p) {
  const dx = (p[0] - t.x) / t.w;
  const dz = (p[2] - t.z) / t.d;
  return Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx) || 1, 0, 0] : [0, 0, Math.sign(dz) || 1];
}

/** Along-face coordinate range of the face with normal n (centre-relative, metres). */
const halfSpan = (t, n) => (n[0] !== 0 ? t.d : t.w);
const planeOffset = (t, n) => (n[0] !== 0 ? t.w : t.d);

/** Snap a point onto the face plane (at the stand-off distance) and return it. */
export function onFace(t, n, p) {
  const off = planeOffset(t, n) + WALL.standOff;
  return n[0] !== 0 ? [t.x + n[0] * off, p[1], p[2]] : [p[0], p[1], t.z + n[2] * off];
}

/**
 * Start wall contact from a physics state.
 * @param {object} t tower {x,z,w,d,h}
 * @param {number[]} pos body position
 * @param {number[]} vel body velocity
 * @param {{climb?:number}} [o] climb: upward speed to convert running momentum into (from the street)
 */
export function enterWall(t, pos, vel, o = {}) {
  const n = faceNormal(t, pos);
  const right = faceRight(n);
  const along = vel[0] * right[0] + vel[2] * right[2];
  const horizontal = Math.abs(along) > WALL.hRunMin && !o.climb;
  return {
    t,
    n,
    pos: onFace(t, n, pos),
    v: horizontal ? [along, Math.max(vel[1], 0) * 0.3] : [along * 0.3, Math.max(vel[1] * 0.5, o.climb || 0)],
    mode: horizontal ? 'hrun' : 'climb',
  };
}

/**
 * Advance wall movement.
 * @param {object} w wall state from enterWall / stepWall (not mutated)
 * @param {{up:number, side:number, fast:boolean}} input -1..1 axes
 * @param {number} dt
 * @returns {{w:object|null, event:null|'vault'|'ground'|'corner', exit?:{pos:number[], vel:number[]}}}
 */
export function stepWall(w, input, dt) {
  const { t } = w;
  let { n, mode } = w;
  let [va, vu] = w.v;
  const k = 1 - Math.exp(-WALL.accel * dt);
  if (mode === 'hrun') {
    const dir = Math.sign(va) || 1;
    va += (dir * WALL.hRunKeep - va) * k * 0.5;
    vu += (-WALL.hRunSink - vu) * k;
    if (input.up > 0.5 || input.side * dir < -0.5 || Math.abs(va) < 5) mode = 'climb';
  } else {
    const speed = input.fast ? WALL.run : WALL.crawl;
    const len = Math.hypot(input.side, input.up) || 1;
    const ta = (input.side / len) * speed * Math.min(1, Math.hypot(input.side, input.up));
    const tu = (input.up / len) * speed * Math.min(1, Math.hypot(input.side, input.up));
    va += (ta - va) * k;
    vu += (tu - vu) * k;
  }
  let right = faceRight(n);
  let pos = [w.pos[0] + right[0] * va * dt, w.pos[1] + vu * dt, w.pos[2] + right[2] * va * dt];

  // corners: past the vertical edge → continue on the neighbouring face
  let event = null;
  const along = n[0] !== 0 ? pos[2] - t.z : pos[0] - t.x;
  const alongSign = n[0] !== 0 ? right[2] : right[0]; // how the right vector maps onto that axis
  if (Math.abs(along) > halfSpan(t, n)) {
    const past = Math.sign(along) * alongSign; // +1 = ran off the right edge
    n = past > 0 ? right : [0 - right[0], 0, 0 - right[2]];
    right = faceRight(n);
    event = 'corner';
  }
  pos = onFace(t, n, pos);
  // keep within the new face's extent too (snaps the corner position cleanly)
  if (n[0] !== 0) pos[2] = clamp(pos[2], t.z - t.d, t.z + t.d);
  else pos[0] = clamp(pos[0], t.x - t.w, t.x + t.w);

  if (pos[1] > t.h - 0.2 && vu > 0) {
    // vault over the ledge onto the roof with a little hop
    const top = [pos[0] - n[0] * (WALL.standOff + WALL.vaultIn), t.h + WALL.standOff + 0.05, pos[2] - n[2] * (WALL.standOff + WALL.vaultIn)];
    return { w: null, event: 'vault', exit: { pos: top, vel: [-n[0] * 6 + right[0] * va * 0.4, 6, -n[2] * 6 + right[2] * va * 0.4] } };
  }
  if (pos[1] <= 1.05 && vu <= 0) {
    return { w: null, event: 'ground', exit: { pos: [pos[0] + n[0] * 0.5, 1.05, pos[2] + n[2] * 0.5], vel: [n[0] * 2, 0, n[2] * 2] } };
  }
  return { w: { t, n, pos, v: [va, vu], mode }, event };
}

/** Kick off the wall: out along the normal, up, and carrying some of the along-wall speed. */
export function wallJump(w) {
  const right = faceRight(w.n);
  const j = WALL.jump;
  return {
    pos: [w.pos[0] + w.n[0] * 0.4, w.pos[1], w.pos[2] + w.n[2] * 0.4],
    vel: [w.n[0] * j.out + right[0] * w.v[0] * j.carry, j.up + Math.max(w.v[1], 0) * 0.3, w.n[2] * j.out + right[2] * w.v[0] * j.carry],
  };
}
