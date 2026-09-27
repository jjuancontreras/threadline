// Sculpted anatomy for THREADRUNNER: every body part is a ring-swept surface whose radius is a
// function of height and angle, so muscle forms (pecs, abs, lats, traps, biceps, quads, calves)
// are real geometry that catches the rim light — no capsules. Angle θ = 0 faces the front (+Z),
// θ = +π/2 the body's left (+X).
import * as THREE from 'three';

const gauss = (x, mu, sigma) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));

/** Piecewise-smooth interpolation through [t, value] pairs (monotone cubic-ish via smoothstep). */
function curve(points) {
  return (t) => {
    if (t <= points[0][0]) return points[0][1];
    for (let i = 0; i < points.length - 1; i++) {
      const [t0, v0] = points[i];
      const [t1, v1] = points[i + 1];
      if (t <= t1) {
        const u = (t - t0) / (t1 - t0);
        return v0 + (v1 - v0) * u * u * (3 - 2 * u);
      }
    }
    return points[points.length - 1][1];
  };
}

/**
 * Sweep a closed cross-section along an axis.
 * @param {{from:number, to:number, rings:number, segs:number,
 *   section:(t:number, theta:number) => [number, number]}} o
 *   section returns the [x, z] offset of the surface point at height fraction t and angle θ.
 *   The sweep runs along Y from `from` to `to`; UV u = 0.5 at the front, v = t.
 */
export function sweep({ from, to, rings, segs, section }) {
  const pos = [];
  const uv = [];
  const index = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = from + (to - from) * t;
    for (let k = 0; k <= segs; k++) {
      const theta = -Math.PI + (k / segs) * Math.PI * 2;
      const [x, z] = section(t, theta);
      pos.push(x, y, z);
      uv.push(0.5 + theta / (Math.PI * 2), to > from ? t : 1 - t);
    }
  }
  const row = segs + 1;
  for (let i = 0; i < rings; i++) {
    for (let k = 0; k < segs; k++) {
      const a = i * row + k;
      const b = a + row;
      // wind outward whichever way the sweep runs
      if (to > from) index.push(a, a + 1, b, a + 1, b + 1, b);
      else index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Cap the open ends of a sweep with a rounded dome (so limbs read as solid at joints). */
function ellipse(rx, rz, theta) {
  return [Math.sin(theta) * rx, Math.cos(theta) * rz];
}

// ---------------------------------------------------------------- torso
// Heights are relative to the spine joint. The torso runs from the lower abdomen to the neck.
export const TORSO = { bottom: -0.12, top: 0.68 };
const halfWidth = curve([[0, 0.168], [0.14, 0.15], [0.3, 0.158], [0.52, 0.212], [0.68, 0.242], [0.8, 0.252], [0.9, 0.205], [1, 0.085]]);
const halfDepth = curve([[0, 0.122], [0.14, 0.112], [0.3, 0.118], [0.52, 0.135], [0.68, 0.152], [0.8, 0.142], [0.9, 0.12], [1, 0.08]]);

function torsoSection(t, theta) {
  const y = TORSO.bottom + (TORSO.top - TORSO.bottom) * t;
  const W = halfWidth(t);
  const D = halfDepth(t);
  // slightly squared cross-section across the chest (superellipse), rounder at the waist
  const n = 2.2 + 0.6 * gauss(t, 0.7, 0.15);
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  let x = Math.sign(s) * Math.abs(s) ** (2 / n) * W;
  let z = Math.sign(c) * Math.abs(c) ** (2 / n) * D;
  const front = Math.max(0, c);
  const back = Math.max(0, -c);
  const side = Math.abs(s);
  let bump = 0;
  // pectorals: two slabs either side of the sternum with a crisp lower edge
  const pecY = y < 0.43 ? gauss(y, 0.43, 0.035) : gauss(y, 0.43, 0.07);
  bump += 0.024 * front ** 1.5 * pecY * (gauss(x, 0.09, 0.055) + gauss(x, -0.09, 0.055)) - 0.006 * front * pecY * gauss(x, 0, 0.012);
  // six-pack: 2 × 3 blocks and the linea alba groove
  let abs = 0;
  for (const ay of [0.07, 0.15, 0.23]) for (const ax of [-0.036, 0.036]) abs += gauss(y, ay, 0.026) * gauss(x, ax, 0.02);
  bump += 0.011 * front ** 2 * abs - 0.005 * front ** 2 * gauss(x, 0, 0.008) * gauss(y, 0.15, 0.12);
  // obliques over the hips, lats flaring under the arms (the V)
  bump += 0.008 * side * gauss(y, 0.06, 0.05);
  bump += 0.022 * gauss(theta, 2.15, 0.35) * gauss(y, 0.32, 0.09) + 0.022 * gauss(theta, -2.15, 0.35) * gauss(y, 0.32, 0.09);
  // shoulder blades, spine groove, trapezius sloping up into the neck
  bump += 0.012 * back * gauss(y, 0.44, 0.06) * (gauss(x, 0.09, 0.05) + gauss(x, -0.09, 0.05));
  bump -= 0.008 * back ** 2 * gauss(x, 0, 0.012) * gauss(y, 0.3, 0.18);
  bump += 0.03 * gauss(y, 0.6, 0.05) * (1 - front) * (gauss(x, 0.09, 0.05) + gauss(x, -0.09, 0.05));
  const r = Math.hypot(x, z) || 1;
  x += (x / r) * bump;
  z += (z / r) * bump;
  return [x, z];
}

export function torsoGeometry() {
  return sweep({ from: TORSO.bottom, to: TORSO.top, rings: 30, segs: 36, section: torsoSection });
}

/** Pelvis block under the torso: glutes at the back, a clean hip line at the front. */
export function pelvisGeometry() {
  const W = curve([[0, 0.16], [0.5, 0.172], [1, 0.155]]);
  const D = curve([[0, 0.11], [0.5, 0.12], [1, 0.11]]);
  return sweep({
    from: -0.12,
    to: 0.12,
    rings: 8,
    segs: 28,
    section: (t, theta) => {
      const [x, z] = ellipse(W(t), D(t), theta);
      const glute = 0.025 * Math.max(0, -Math.cos(theta)) * gauss(t, 0.35, 0.25) * (gauss(x, 0.07, 0.05) + gauss(x, -0.07, 0.05));
      const r = Math.hypot(x, z) || 1;
      return [x + (x / r) * glute, z + (z / r) * glute];
    },
  });
}

// ---------------------------------------------------------------- limbs
// Limbs hang from their joint along -Y. `side` = +1 left, -1 right (mirrors inner/outer muscles).
export const LIMB = { upperArm: 0.34, forearm: 0.32, thigh: 0.54, shin: 0.52 };

function limb(length, base, muscles, rings = 16, segs = 18) {
  return sweep({
    from: 0,
    to: -length,
    rings,
    segs,
    section: (t, theta) => {
      const r = base(t) + muscles(t, theta);
      return ellipse(r, r * 0.96, theta);
    },
  });
}

export function upperArmGeometry(side) {
  const base = curve([[0, 0.088], [0.2, 0.09], [0.5, 0.086], [0.82, 0.066], [1, 0.058]]);
  return limb(LIMB.upperArm, base, (t, th) =>
    0.028 * gauss(t, 0.5, 0.17) * Math.max(0, Math.cos(th)) ** 1.4 + // biceps
    0.018 * gauss(t, 0.35, 0.2) * Math.max(0, -Math.cos(th)) ** 1.2 + // triceps
    0.006 * gauss(t, 0.12, 0.1) * Math.max(0, Math.sin(th) * side), // outer head of the deltoid
  );
}

export function forearmGeometry(side) {
  const base = curve([[0, 0.07], [0.22, 0.078], [0.6, 0.058], [1, 0.045]]);
  return limb(LIMB.forearm, base, (t, th) =>
    0.014 * gauss(t, 0.2, 0.14) * Math.max(0, Math.sin(th) * side + 0.3 * Math.cos(th)) + // brachioradialis
    0.007 * gauss(t, 0.3, 0.2) * Math.max(0, -Math.sin(th) * side),
  );
}

export function thighGeometry(side) {
  const base = curve([[0, 0.128], [0.3, 0.128], [0.72, 0.097], [1, 0.076]]);
  return limb(LIMB.thigh, base, (t, th) =>
    0.025 * gauss(t, 0.45, 0.22) * Math.max(0, Math.cos(th)) ** 1.3 + // quadriceps
    0.013 * gauss(t, 0.84, 0.07) * Math.max(0, Math.cos(th) - 0.4 * Math.sin(th) * side) + // vastus medialis teardrop
    0.012 * gauss(t, 0.4, 0.2) * Math.max(0, -Math.cos(th)) + // hamstrings
    0.008 * gauss(t, 0.25, 0.2) * Math.max(0, Math.sin(th) * side), // outer sweep
  );
}

export function shinGeometry() {
  const base = curve([[0, 0.074], [0.28, 0.078], [0.72, 0.054], [1, 0.045]]);
  return limb(LIMB.shin, base, (t, th) =>
    0.03 * gauss(t, 0.28, 0.14) * Math.max(0, -Math.cos(th)) ** 1.2 + // calves
    0.006 * gauss(t, 0.05, 0.05) * Math.max(0, Math.cos(th)), // knee cap
  );
}

/** Neck: a short tapering column with the sternocleidomastoid lines. */
export function neckGeometry() {
  return sweep({
    from: 0,
    to: 0.13,
    rings: 6,
    segs: 18,
    section: (t, th) => {
      const r = 0.064 - 0.01 * t + 0.006 * gauss(Math.abs(th), 0.7, 0.25) * (1 - t);
      return ellipse(r, r * 1.05, th);
    },
  });
}

/** Deltoid cap: a rounded shoulder that makes the frame read wide. */
export function deltoidGeometry() {
  const g = new THREE.SphereGeometry(0.094, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58);
  g.scale(1.06, 0.9, 1.08);
  return g;
}

/** Boot: a tapered, toe-down shape (sweep along the foot's length). */
export function footGeometry() {
  const g = sweep({
    from: 0,
    to: 0.3,
    rings: 10,
    segs: 16,
    section: (t, th) => {
      const w = 0.055 * (1 - 0.35 * t) + 0.01 * gauss(t, 0.7, 0.2);
      const h = 0.05 * (1 - 0.55 * t);
      return ellipse(w, h, th);
    },
  });
  g.rotateX(Math.PI / 2); // run the sweep along +Z (toes forward)
  g.translate(0, 0, -0.07);
  return g;
}

/** Open, clawed hand: palm slab + finger block + thumb. */
export function handGeometry() {
  const palm = new THREE.SphereGeometry(0.052, 14, 10);
  palm.scale(0.62, 1.15, 1.05);
  return palm;
}
