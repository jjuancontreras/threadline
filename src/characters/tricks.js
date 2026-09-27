// Aerial acrobatics, keyframed. Each trick is a short timeline of body rotations (in the travel
// frame: pitch = flip about the left axis, roll = barrel roll about the travel direction,
// yaw = flat spin about world up) plus pose weights. Channels are interpolated with cubic
// Hermite splines, so moves have anticipation, a readable "hang" at the key pose and a
// follow-through instead of a constant-speed spin. Every trick ends on whole turns.
// Style reference: the swagger of Insomniac's Spider-Man air tricks — twisting layouts, lazy
// barrel rolls, a lay-back "chill" pose, scissor kicks — described in RESEARCH.md §11.
import { vNorm, vCross, clamp } from '../core/math.js';

const TAU = Math.PI * 2;

/** keys: [t (0..1), pitch, roll, yaw, pose weights] */
const DEFS = {
  // front flip that twists out into a layout: tuck → half twist at the top → open and spot the landing
  twistflip: {
    time: 1.05,
    keys: [
      [0, 0, 0, 0, { fly: 1 }],
      [0.14, -0.3, 0, 0, { fly: 0.6, spread: 0.4 }], // anticipation: open the chest
      [0.42, TAU * 0.45, TAU * 0.2, 0, { tuck: 1 }],
      [0.62, TAU * 0.72, TAU * 0.62, 0, { tuck: 0.5, spread: 0.5 }], // hang: twisting through the top
      [0.84, TAU * 0.96, TAU * 0.96, 0, { spread: 0.8, fly: 0.2 }],
      [1, TAU, TAU, 0, { fly: 1 }],
    ],
  },
  // two lazy barrel rolls about the travel line, arms pinned then flung wide
  corkscrew: {
    time: 1.0,
    keys: [
      [0, 0, 0, 0, { dive: 1 }],
      [0.18, 0.15, -0.35, 0, { dive: 0.7, tuck: 0.3 }], // wind-up the other way
      [0.5, 0.25, TAU * 1.05, 0, { dive: 0.4, tuck: 0.6 }],
      [0.8, 0.1, TAU * 1.85, 0, { spread: 0.8, dive: 0.2 }],
      [1, 0, TAU * 2, 0, { dive: 1 }],
    ],
  },
  // lie back mid-air, hands behind the head, and roll over once — pure swagger
  lazyroll: {
    time: 1.3,
    keys: [
      [0, 0, 0, 0, { fly: 1 }],
      [0.22, -0.9, 0.2, 0, { layback: 1 }],
      [0.55, -1.0, TAU * 0.5, 0, { layback: 1 }], // hang on the back, rolling slowly
      [0.82, -0.55, TAU * 0.92, 0, { layback: 0.5, fly: 0.5 }],
      [1, 0, TAU, 0, { fly: 1 }],
    ],
  },
  // flat 360 spin with a scissor kick, like whipping round to look back at the city
  scissor: {
    time: 0.95,
    keys: [
      [0, 0, 0, 0, { fly: 1 }],
      [0.2, -0.15, 0.25, -0.35, { scissor: 0.6, fly: 0.4 }],
      [0.5, -0.3, 0.35, TAU * 0.5, { scissor: 1 }],
      [0.78, -0.15, 0.15, TAU * 0.9, { scissor: 0.6, spread: 0.4 }],
      [1, 0, 0, TAU, { fly: 1 }],
    ],
  },
  // backflip in a straight layout with a long hang upside-down, arms spread
  backflip: {
    time: 1.15,
    keys: [
      [0, 0, 0, 0, { fly: 1 }],
      [0.15, 0.25, 0, 0, { tuck: 0.4, fly: 0.6 }], // dip before throwing the head back
      [0.45, -TAU * 0.44, 0, 0, { spread: 1 }],
      [0.62, -TAU * 0.56, TAU * 0.04, 0, { spread: 1 }], // hang
      [0.85, -TAU * 0.93, 0, 0, { tuck: 0.4, fly: 0.6 }],
      [1, -TAU, 0, 0, { fly: 1 }],
    ],
  },
  // coming off the slingshot: arms thrown wide, one slow corkscrew into a dive
  launch: {
    time: 1.1,
    keys: [
      [0, 0, 0, 0, { spread: 1 }],
      [0.3, -0.35, TAU * 0.2, 0, { spread: 1 }],
      [0.65, -0.2, TAU * 0.72, 0, { spread: 0.5, dive: 0.5 }],
      [1, 0, TAU, 0, { dive: 0.6, fly: 0.4 }],
    ],
  },
};

export const TRICKS = ['twistflip', 'lazyroll', 'corkscrew', 'scissor', 'backflip'];
export const TRICK_TIME = Object.fromEntries(Object.entries(DEFS).map(([k, d]) => [k, d.time]));

/** Cubic Hermite through (t, v) keys with Catmull-Rom tangents (clamped flat at the ends). */
function hermite(keys, ch, t) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const [t0, t1] = [keys[i][0], keys[i + 1][0]];
  const v0 = keys[i][ch];
  const v1 = keys[i + 1][ch];
  const slope = (a, b) => (keys[b][ch] - keys[a][ch]) / (keys[b][0] - keys[a][0]);
  const m0 = i === 0 ? 0 : slope(i - 1, i + 1);
  const m1 = i + 1 === keys.length - 1 ? 0 : slope(i, i + 2);
  const h = t1 - t0;
  const u = clamp((t - t0) / h);
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * h * m1;
}

function blendPose(keys, t) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const u = clamp((t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]));
  const e = u * u * (3 - 2 * u);
  const out = {};
  for (const [k, w] of Object.entries(keys[i][4])) out[k] = (out[k] || 0) + w * (1 - e);
  for (const [k, w] of Object.entries(keys[i + 1][4])) out[k] = (out[k] || 0) + w * e;
  return out;
}

// quaternion helpers ([x, y, z, w])
const qAxis = (a, angle) => {
  const s = Math.sin(angle / 2);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(angle / 2)];
};
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];

/**
 * @param {string} kind trick name
 * @param {number} k progress through the trick, 0..1
 * @param {number[]} vdir travel direction (normalized)
 * @returns {{quat:number[], weights:Record<string, number>, angles:number[]}}
 *   quat: world-space rotation applied on top of the body's base orientation
 */
export function trickAt(kind, k, vdir) {
  const def = DEFS[kind] || DEFS.twistflip;
  const t = clamp(k);
  const [pitch, roll, yaw] = [1, 2, 3].map((ch) => hermite(def.keys, ch, t));
  const flat = vNorm([vdir[0], 0, vdir[2]]);
  const fwd = Math.hypot(flat[0], flat[2]) > 0.5 ? flat : [0, 0, 1];
  const left = vNorm(vCross([0, 1, 0], fwd));
  // roll first (about travel), then pitch (flip), then yaw (flat spin) — all world axes
  const quat = qMul(qAxis([0, 1, 0], yaw), qMul(qAxis(left, pitch), qAxis(fwd, roll)));
  return { quat, weights: blendPose(def.keys, t), angles: [pitch, roll, yaw] };
}

/** Which slice of a flight segment the trick occupies (leaves room to exit and re-aim). */
export function trickWindow(segmentProgress) {
  return clamp((segmentProgress - 0.12) / 0.6);
}
