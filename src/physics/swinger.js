// Point-mass swinger integrated with position Verlet (Jakobsen, "Advanced Character Physics").
// Velocity is implicit (pos - prev), so a one-sided rope constraint that projects the
// position back onto the rope sphere removes only the outward radial component and
// preserves tangential momentum — which is what makes release-and-fly feel right.
import { vSub, vLen, vScale, vAdd } from '../core/math.js';

export const SWING = {
  gravity: 17,
  airDrag: 0.0009, // per-step fractional velocity loss
  radius: 0.7, // hero collision radius
  minRope: 6,
  reelSpeed: 1.6, // m/s the rope shortens while held (gives a pump)
  control: 11, // m/s² of air control
  maxSpeed: 70,
  floor: 1,
};

export function createSwinger(pos, vel = [0, 0, 0], dt = 1 / 120) {
  return {
    pos: [...pos],
    prev: vSub(pos, vScale(vel, dt)),
    anchor: null,
    ropeLength: 0,
    grounded: false,
  };
}

export function velocity(s, dt) {
  return vScale(vSub(s.pos, s.prev), 1 / dt);
}

export function attach(s, anchor, slack = 0.97) {
  const len = Math.max(vLen(vSub(s.pos, anchor)) * slack, SWING.minRope);
  return { ...s, anchor: [...anchor], ropeLength: len };
}

export function release(s, dt, boost = 0) {
  if (!s.anchor) return s;
  const v = velocity(s, dt);
  const sp = vLen(v) || 1;
  const nv = vScale(v, (sp + boost) / sp);
  return { ...s, anchor: null, ropeLength: 0, prev: vSub(s.pos, vScale(nv, dt)) };
}

function collideTowers(pos, prev, towers, friction = true) {
  const r = SWING.radius;
  let p = pos;
  let q = prev;
  let roof = null;
  let side = null; // tower whose wall pushed us out sideways (wall-run contact)
  for (const t of towers) {
    const inX = Math.abs(p[0] - t.x) < t.w + r;
    const inZ = Math.abs(p[2] - t.z) < t.d + r;
    if (!inX || !inZ || p[1] > t.h + r) continue;
    const px = t.w + r - Math.abs(p[0] - t.x);
    const pz = t.d + r - Math.abs(p[2] - t.z);
    const py = t.h + r - p[1];
    if (py <= px && py <= pz) {
      p = [p[0], t.h + r, p[2]];
      const f = friction ? 0.15 : 0;
      q = [q[0] + (p[0] - q[0]) * f, p[1], q[2] + (p[2] - q[2]) * f]; // roof friction (off while running)
      roof = t.h;
    } else if (px < pz) {
      const x = t.x + Math.sign(p[0] - t.x) * (t.w + r);
      p = [x, p[1], p[2]];
      q = [x, q[1], q[2]];
      side = t;
    } else {
      const z = t.z + Math.sign(p[2] - t.z) * (t.d + r);
      p = [p[0], p[1], z];
      q = [q[0], q[1], z];
      side = t;
    }
  }
  return [p, q, roof, side];
}

/**
 * Advance one fixed step. Returns a NEW swinger (inputs are not mutated).
 * @param {object} s swinger
 * @param {number} dt fixed step
 * @param {{control?: number[], towers?: object[], reel?: boolean, reelSpeed?: number, friction?: boolean}} opts
 *   friction:false = the caller drives ground velocity itself (running)
 */
export function step(s, dt, opts = {}) {
  const ctrl = opts.control || [0, 0, 0];
  const acc = [ctrl[0] * SWING.control, -SWING.gravity + ctrl[1] * SWING.control, ctrl[2] * SWING.control];
  const vel = vSub(s.pos, s.prev);
  const damped = vScale(vel, 1 - SWING.airDrag);
  const sp = vLen(damped) / dt;
  const capped = sp > SWING.maxSpeed ? vScale(damped, SWING.maxSpeed / sp) : damped;
  let pos = vAdd(vAdd(s.pos, capped), vScale(acc, dt * dt));
  let prev = s.pos;
  let ropeLength = s.ropeLength;

  if (s.anchor) {
    if (opts.reel) ropeLength = Math.max(SWING.minRope, ropeLength - (opts.reelSpeed ?? SWING.reelSpeed) * dt);
    const d = vSub(pos, s.anchor);
    const len = vLen(d);
    if (len > ropeLength) pos = vAdd(s.anchor, vScale(d, ropeLength / len));
  }

  let grounded = false;
  let groundY = null;
  let wall = null;
  if (opts.towers) {
    let roof;
    [pos, prev, roof, wall] = collideTowers(pos, prev, opts.towers, opts.friction !== false);
    if (roof !== null) {
      grounded = true;
      groundY = roof;
    }
  }

  if (pos[1] < SWING.floor) {
    pos = [pos[0], SWING.floor, pos[2]];
    const f = opts.friction === false ? 0 : 0.2;
    prev = [prev[0] + (pos[0] - prev[0]) * f, SWING.floor, prev[2] + (pos[2] - prev[2]) * f];
    grounded = true;
    groundY = 0;
  }
  return { ...s, pos, prev, ropeLength, grounded, groundY, wall };
}
