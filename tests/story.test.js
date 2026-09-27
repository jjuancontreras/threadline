import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storyTime } from '../src/scenes/chapters/impact.js';
import { slingAnchors, WATCH_SPOT } from '../src/scenes/chapters/threat.js';
import { trickAt, trickWindow, TRICKS } from '../src/characters/tricks.js';
import { gaitOffsets, strideLength, gaitRate, POSES, mirrorPose } from '../src/characters/poses.js';
import { createCues } from '../src/scenes/cues.js';
import { generateTowers } from '../src/core/layout.js';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('storyTime is continuous and monotonic across the bullet-time ramp', () => {
  let prev = -Infinity;
  for (let i = 0; i <= 1000; i++) {
    const t = storyTime(i / 1000, false);
    assert.ok(t >= prev, `not monotonic at p=${i / 1000}`);
    assert.ok(t - prev < 0.05 || i === 0, `jump at p=${i / 1000}`);
    prev = t;
  }
  assert.equal(storyTime(0, false), 0);
  assert.ok(close(storyTime(1, false), 6.5));
});

test('storyTime slows story time during the container flight (bullet time)', () => {
  const dp = 0.01;
  const normal = (storyTime(0.1 + dp, false) - storyTime(0.1, false)) / dp;
  const bullet = (storyTime(0.5 + dp, false) - storyTime(0.5, false)) / dp;
  assert.ok(bullet < normal * 0.5, `bullet ${bullet} vs normal ${normal}`);
});

test('reduced motion maps scroll to story time linearly (no ramp)', () => {
  assert.ok(close(storyTime(0.5, true), 3.25));
  assert.ok(close(storyTime(0.25, true) * 2, storyTime(0.5, true)));
});

const qAngle = (q) => 2 * Math.acos(Math.min(1, Math.abs(q[3])));

test('every trick starts and ends in the base orientation (whole turns only)', () => {
  const v = [0, 0, -1];
  for (const kind of [...new Set(TRICKS), 'launch']) {
    assert.ok(qAngle(trickAt(kind, 0, v).quat) < 1e-6, `${kind} start`);
    assert.ok(qAngle(trickAt(kind, 1, v).quat) < 1e-6, `${kind} end`);
  }
});

test('trick rotations are smooth: no frame-to-frame snaps and always unit quaternions', () => {
  const v = [0.6, -0.2, -0.8];
  for (const kind of new Set(TRICKS)) {
    let prev = trickAt(kind, 0, v).quat;
    for (let k = 0.01; k <= 1.0001; k += 0.01) {
      const q = trickAt(kind, k, v).quat;
      assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-9, `${kind} not unit`);
      const dot = Math.abs(prev[0] * q[0] + prev[1] * q[1] + prev[2] * q[2] + prev[3] * q[3]);
      assert.ok(2 * Math.acos(Math.min(1, dot)) < 0.45, `${kind} snaps at k=${k.toFixed(2)}`);
      prev = q;
    }
  }
});

test('tricks are not constant-speed spins: they wind up, hang and follow through', () => {
  for (const kind of ['twistflip', 'backflip', 'corkscrew']) {
    const rates = [];
    let prev = trickAt(kind, 0, [0, 0, 1]).angles;
    for (let k = 0.02; k <= 1.0001; k += 0.02) {
      const a = trickAt(kind, k, [0, 0, 1]).angles;
      rates.push(Math.hypot(a[0] - prev[0], a[1] - prev[1], a[2] - prev[2]));
      prev = a;
    }
    const max = Math.max(...rates);
    const min = Math.min(...rates.slice(3, -3));
    assert.ok(max > min * 1.8, `${kind} spins at a constant rate`);
  }
});

test('trick poses always have weight and include a shape change', () => {
  for (const kind of new Set(TRICKS)) {
    const shapes = new Set();
    for (let k = 0; k <= 1; k += 0.1) {
      const w = trickAt(kind, k, [0, 0, 1]).weights;
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      assert.ok(sum > 0.5, `${kind} empty pose`);
      shapes.add(Object.entries(w).sort((a, b) => b[1] - a[1])[0][0]);
    }
    assert.ok(shapes.size >= 2, `${kind} never changes shape`);
  }
});

test('trickAt clamps progress outside 0..1', () => {
  assert.ok(qAngle(trickAt('twistflip', -1, [1, 0, 0]).quat) < 1e-6);
  assert.deepEqual(trickAt('scissor', 2, [1, 0, 0]).quat, trickAt('scissor', 1, [1, 0, 0]).quat);
});

test('trickWindow leaves a lead-in and an exit within a flight segment', () => {
  assert.equal(trickWindow(0), 0);
  assert.equal(trickWindow(0.12), 0);
  assert.equal(trickWindow(0.72), 1);
  assert.equal(trickWindow(1), 1);
  assert.ok(close(trickWindow(0.42), 0.5));
});

test('gait swings the legs in opposition and is zero at zero amount', () => {
  const g = gaitOffsets(Math.PI / 2, 1);
  assert.ok(g.hipL[0] < 0 && g.hipR[0] > 0, 'hips should oppose');
  assert.ok(g.shL[0] > 0 && g.shR[0] < 0, 'arms should oppose');
  const still = gaitOffsets(1.3, 0);
  for (const [k, v] of Object.entries(still)) {
    const vals = Array.isArray(v) ? v : [v];
    assert.ok(vals.every((x) => Math.abs(x) < 1e-12), `${k} not zero`);
  }
});

test('walking cadence is calm and sprinting cadence stays human-readable', () => {
  const hz = (v) => gaitRate(v) / (Math.PI * 2);
  assert.ok(hz(4) > 0.9 && hz(4) < 1.5, `walk ${hz(4)} Hz`);
  assert.ok(hz(26) > 1.8 && hz(26) < 2.8, `sprint ${hz(26)} Hz`);
  assert.equal(gaitRate(0), 0);
});

test('stride length grows with speed so feet do not skate', () => {
  let prev = 0;
  for (let v = 0; v <= 30; v += 0.5) {
    const s = strideLength(v);
    assert.ok(s >= prev, `stride shrank at ${v}`);
    prev = s;
  }
  assert.ok(strideLength(26) > strideLength(4) * 2.5);
});

test('the run blend swings the legs harder than the walk', () => {
  const walk = gaitOffsets(Math.PI / 2, 1, 0);
  const run = gaitOffsets(Math.PI / 2, 1, 1);
  assert.ok(Math.abs(run.hipL[0]) > Math.abs(walk.hipL[0]) * 1.6);
  assert.ok(run.elL[0] < walk.elL[0], 'running elbows bend more');
});

test('mirrorPose swaps sides and flips the sideways rotations', () => {
  const m = mirrorPose({ shR: [0.1, 0.2, -2.9], hipL: [0.4, 0, 0.1], spine: [0.5, 0.3, 0.1] });
  assert.deepEqual(m.shL, [0.1, -0.2, 2.9]);
  assert.deepEqual(m.hipR, [0.4, -0, -0.1]);
  assert.deepEqual(m.spine, [0.5, -0.3, -0.1]);
  assert.ok(POSES.swingL && POSES.shootL, 'left-hand variants exist');
});

test('gait knees never hyper-extend (bend is always >= 0)', () => {
  for (const run of [0, 0.5, 1]) {
    for (let ph = 0; ph < Math.PI * 4; ph += 0.1) {
      const g = gaitOffsets(ph, 1, run);
      assert.ok(g.knL[0] >= 0 && g.knR[0] >= 0);
    }
  }
});

test('slingAnchors picks one anchor on each side, above and ahead of the landing roof', () => {
  const towers = generateTowers(1);
  const from = [WATCH_SPOT[0] + 60, WATCH_SPOT[1] + 20, WATCH_SPOT[2] + 120];
  const [l, r] = slingAnchors(towers, from, WATCH_SPOT);
  const dir = [WATCH_SPOT[0] - from[0], WATCH_SPOT[2] - from[2]];
  const n = Math.hypot(...dir);
  const right = [-dir[1] / n, dir[0] / n];
  const lat = (p) => (p[0] - WATCH_SPOT[0]) * right[0] + (p[2] - WATCH_SPOT[2]) * right[1];
  assert.ok(lat(l) < 0 && lat(r) > 0, 'anchors should straddle the line of travel');
  assert.ok(l[1] > WATCH_SPOT[1] && r[1] > WATCH_SPOT[1], 'anchors should be above the roof');
});

test('slingAnchors falls back to synthetic points when no tower qualifies', () => {
  const [l, r] = slingAnchors([], [0, 50, 100], [0, 50, 0]);
  assert.ok(l[1] > 50 && r[1] > 50);
  assert.ok(l[0] < 0 !== r[0] < 0, 'fallbacks on opposite sides');
});

test('a cue fires once on entry and re-arms after its window is left', () => {
  const cues = createCues();
  let n = 0;
  const fire = (active, back = false) => cues.cue('boom', active, back, () => n++);
  fire(true);
  fire(true);
  assert.equal(n, 1);
  fire(false);
  fire(true);
  assert.equal(n, 2);
});

test('a cue entered while scrubbing backwards does not fire, and stays quiet until re-armed', () => {
  const cues = createCues();
  let n = 0;
  cues.cue('flash', true, true, () => n++);
  cues.cue('flash', true, false, () => n++);
  assert.equal(n, 0);
  cues.cue('flash', false, false, () => n++);
  cues.cue('flash', true, false, () => n++);
  assert.equal(n, 1);
});
