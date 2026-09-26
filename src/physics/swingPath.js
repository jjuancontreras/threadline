// Chapter 2: run the real swing physics once with a scripted "autopilot" and record it.
// Scroll then scrubs through the recording, so the sequence is physically simulated
// but still fully reversible and deterministic.
import { createSwinger, step, attach, release, velocity } from './swinger.js';
import { pickAnchor } from './anchors.js';
import { towersNear } from '../core/layout.js';
import { vNorm, vLen } from '../core/math.js';

export const PATH_DT = 1 / 120;
export const PATH_START = [-27.6, 151.0, 21.6]; // the spire's south-east corner
const START_VEL = [7, 6, -12];
const END_Z = -425;
const MAX_T = 18;
const SAMPLE_EVERY = 2; // record at 60 Hz

function wantsFire(s, v, sinceRelease, t) {
  if (s.anchor) return false;
  if (t < 1.25) return false; // dramatic free-fall off the spire
  return sinceRelease > 0.3 && (v[1] < -2 || s.pos[1] < 45);
}

function wantsRelease(s, v, attachedFor) {
  if (!s.anchor) return false;
  if (attachedFor > 3.2) return true;
  const past = s.anchor[2] - s.pos[2];
  return v[1] > 1.5 && past > s.ropeLength * 0.32;
}

/**
 * @param {object[]} towers
 * @returns {{t:number, pos:number[], vel:number[], anchor:number[]|null}[]}
 */
export function simulateSwingPath(towers) {
  let s = createSwinger(PATH_START, START_VEL, PATH_DT);
  const samples = [];
  let side = 1;
  let sinceRelease = 0;
  let attachedFor = 0;
  let near = towersNear(towers, s.pos, 160);
  for (let i = 0, t = 0; t < MAX_T; i++, t += PATH_DT) {
    const v = velocity(s, PATH_DT);
    if (i % 30 === 0) near = towersNear(towers, s.pos, 160);
    if (wantsFire(s, v, sinceRelease, t)) {
      const aim = vNorm([side * 0.85 - s.pos[0] * 0.035, 1.0, -1.4]);
      const hit = pickAnchor(s.pos, aim, near, { reach: 46, minClearance: 16 });
      if (hit) {
        s = attach(s, hit.point, 1.0);
        side = -side;
        attachedFor = 0;
      }
    } else if (wantsRelease(s, v, attachedFor)) {
      s = release(s, PATH_DT, 2.5);
      sinceRelease = 0;
    }
    // gentle steering toward the avenue centre-line keeps the recorded path in the canyon
    const steer = [-s.pos[0] * 0.035 - v[0] * 0.09, 0, s.anchor ? -0.5 : -0.2];
    s = step(s, PATH_DT, { towers: near, control: steer, reel: !!s.anchor, reelSpeed: 4.5 });
    sinceRelease += PATH_DT;
    attachedFor += PATH_DT;
    if (i % SAMPLE_EVERY === 0) {
      samples.push({ t, pos: [...s.pos], vel: velocity(s, PATH_DT), anchor: s.anchor ? [...s.anchor] : null });
    }
    if (s.pos[2] < END_Z) break;
  }
  return samples;
}

/** Centripetal-free uniform Catmull-Rom between p1 and p2 (C1-continuous: no kinks). */
function cr(p0, p1, p2, p3, u) {
  const u2 = u * u;
  const u3 = u2 * u;
  return [0, 1, 2].map(
    (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3),
  );
}

/** Sample the recording at normalized u (0..1): spline position, smoothed velocity. */
export function samplePath(samples, u) {
  const n = samples.length;
  const f = Math.min(Math.max(u, 0), 1) * (n - 1);
  const i = Math.min(Math.floor(f), n - 2);
  const k = f - i;
  const at = (j) => samples[Math.min(Math.max(j, 0), n - 1)];
  const pos = cr(at(i - 1).pos, at(i).pos, at(i + 1).pos, at(i + 2).pos, k);
  const vel = cr(at(i - 1).vel, at(i).vel, at(i + 1).vel, at(i + 2).vel, k);
  return { pos, vel, anchor: k < 0.5 ? at(i).anchor : at(i + 1).anchor, speed: vLen(vel), index: k < 0.5 ? i : i + 1 };
}

/**
 * Per-sample metadata: time since the current tether attached, and for free-flight
 * samples the flight segment (start/end time + ordinal) used to schedule tricks.
 */
export function annotatePath(samples) {
  const sinceAttach = new Float32Array(samples.length);
  const flight = samples.map(() => null);
  let start = 0;
  let seg = -1;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const prev = samples[i - 1];
    if (s.anchor && (!prev?.anchor || prev.anchor[0] !== s.anchor[0] || prev.anchor[2] !== s.anchor[2])) start = s.t;
    sinceAttach[i] = s.anchor ? s.t - start : 0;
    if (!s.anchor) {
      if (!prev || prev.anchor) seg++;
      flight[i] = { seg, start: s.t, end: s.t };
    }
  }
  // back-fill segment end times
  for (let i = samples.length - 1; i >= 0; i--) {
    const f = flight[i];
    if (!f) continue;
    const next = flight[i + 1];
    f.end = next && next.seg === f.seg ? next.end : samples[i].t;
    const first = flight[i - 1];
    if (first && first.seg === f.seg) continue;
    for (let k = i; flight[k] && flight[k].seg === f.seg; k++) flight[k].start = samples[i].t;
  }
  return { sinceAttach, flight };
}
