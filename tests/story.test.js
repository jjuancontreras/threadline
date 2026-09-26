import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storyTime } from '../src/scenes/chapters/impact.js';
import { slingAnchors, WATCH_SPOT } from '../src/scenes/chapters/threat.js';
import { trickAt, trickWindow, TRICKS } from '../src/characters/tricks.js';
import { gaitOffsets } from '../src/characters/poses.js';
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

test('every trick completes whole rotations and starts/ends in its rest pose', () => {
  const v = [0, 0, -1];
  for (const kind of new Set(TRICKS)) {
    const start = trickAt(kind, 0, v);
    const end = trickAt(kind, 1, v);
    assert.ok(close(start.angle, 0), kind);
    const turns = Math.abs(end.angle) / (Math.PI * 2);
    assert.ok(close(turns, Math.round(turns), 1e-9) && turns >= 1, `${kind} turns=${turns}`);
    const axisLen = Math.hypot(...end.axis);
    assert.ok(close(axisLen, 1, 1e-6), `${kind} axis not unit`);
  }
});

test('trickAt clamps progress outside 0..1', () => {
  assert.ok(close(trickAt('twirl', -1, [1, 0, 0]).angle, 0));
  assert.deepEqual(trickAt('twirl', 2, [1, 0, 0]).angle, trickAt('twirl', 1, [1, 0, 0]).angle);
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

test('gait knees never hyper-extend (bend is always >= 0)', () => {
  for (let ph = 0; ph < Math.PI * 4; ph += 0.1) {
    const g = gaitOffsets(ph, 1);
    assert.ok(g.knL[0] >= 0 && g.knR[0] >= 0);
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
