import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSwinger, step, attach, release, velocity } from '../src/physics/swinger.js';
import { createRope, stepRope } from '../src/physics/rope.js';
import { pickAnchor, closestOnTower } from '../src/physics/anchors.js';
import { simulateSwingPath, samplePath } from '../src/physics/swingPath.js';
import { createRescue, stepRescue, fireAnchor, anchoredCount } from '../src/physics/rescue.js';
import { generateTowers, WORLD } from '../src/core/layout.js';
import { vDist, vLen } from '../src/core/math.js';

const DT = 1 / 120;

test('free-falling swinger accelerates downward under gravity', () => {
  let s = createSwinger([0, 100, 0], [0, 0, 0], DT);
  for (let i = 0; i < 120; i++) s = step(s, DT);
  assert.ok(velocity(s, DT)[1] < -15);
});

test('rope constraint keeps swinger within rope length of the anchor', () => {
  let s = attach(createSwinger([10, 50, 0], [0, 0, -20], DT), [0, 60, 0], 1);
  const len = s.ropeLength;
  for (let i = 0; i < 600; i++) {
    s = step(s, DT);
    assert.ok(vDist(s.pos, s.anchor) <= len + 1e-6);
  }
});

test('release preserves momentum (speed before ~= speed after, plus boost)', () => {
  let s = attach(createSwinger([10, 50, 0], [0, 0, -20], DT), [0, 60, 0], 1);
  for (let i = 0; i < 100; i++) s = step(s, DT);
  const before = vLen(velocity(s, DT));
  const r = release(s, DT, 0);
  assert.equal(r.anchor, null);
  assert.ok(Math.abs(vLen(velocity(r, DT)) - before) < 1e-6);
});

test('step does not mutate its input', () => {
  const s = createSwinger([0, 10, 0], [1, 0, 0], DT);
  const copy = JSON.stringify(s);
  step(s, DT);
  assert.equal(JSON.stringify(s), copy);
});

test('swinger cannot pass through a tower wall', () => {
  const tower = { x: 0, z: 0, w: 5, d: 5, h: 50 };
  let s = createSwinger([-10, 20, 0], [30, 0, 0], DT);
  for (let i = 0; i < 120; i++) s = step(s, DT, { towers: [tower] });
  assert.ok(s.pos[0] < -5);
});

test('rope endpoints stay pinned', () => {
  const rope = createRope(10);
  for (let i = 0; i < 30; i++) stepRope(rope, [0, 0, 0], [0, 10, 5], DT);
  assert.ok(Math.abs(rope.pos[rope.pos.length - 2] - 10) < 1e-4);
  assert.ok(Math.abs(rope.pos[1]) < 1e-4);
});

test('closestOnTower returns a surface point', () => {
  const t = { x: 0, z: 0, w: 5, d: 5, h: 30 };
  assert.deepEqual(closestOnTower(t, [20, 10, 0]), [5, 10, 0]);
});

test('pickAnchor finds a point above the hero toward the aim', () => {
  const towers = [{ x: 20, z: -40, w: 8, d: 8, h: 90 }];
  const hit = pickAnchor([0, 30, 0], [0.3, 0.8, -0.6], towers);
  assert.ok(hit);
  assert.ok(hit.point[1] > 33);
});

test('pickAnchor returns null when nothing is in range', () => {
  assert.equal(pickAnchor([0, 30, 0], [0, 1, 0], [{ x: 900, z: 900, w: 5, d: 5, h: 50 }]), null);
});

test('chapter-2 swing path travels the canyon without touching the ground', () => {
  const samples = simulateSwingPath(generateTowers(1));
  const minY = Math.min(...samples.map((s) => s.pos[1]));
  const last = samples[samples.length - 1];
  assert.ok(minY > 15, `minY ${minY}`);
  assert.ok(last.pos[2] < -400);
  assert.ok(samples.filter((s, i) => s.anchor && !samples[i - 1]?.anchor).length >= 4);
  assert.ok(samplePath(samples, 0.5).speed > 10);
});

test('rescue auto-completes with no user input and stops at the margin', () => {
  const { gap, train } = WORLD;
  let r = createRescue(-200, gap.xMin, train.stopMargin);
  for (let i = 0; i < 60 * 40 && !r.saved; i++) r = stepRescue(r, 1 / 60);
  assert.ok(r.saved);
  assert.equal(anchoredCount(r), 4);
  assert.ok(Math.abs(gap.xMin - r.x - train.stopMargin) < 1e-9);
});

test('rescue with fast user input also stops exactly at the margin', () => {
  let r = createRescue(-200, -12, 0.25);
  for (let k = 0; k < 4; k++) r = fireAnchor(r, k);
  assert.equal(r.fired.every((f) => !f.auto), true);
  for (let i = 0; i < 60 * 40 && !r.saved; i++) r = stepRescue(r, 1 / 60);
  assert.ok(r.saved);
  assert.ok(Math.abs(-12 - r.x - 0.25) < 1e-9);
});

test('firing the same anchor twice is a no-op', () => {
  const r = fireAnchor(fireAnchor(createRescue(-200, -12, 0.25), 1), 1);
  assert.equal(r.fired.length, 1);
});

test('running on the ground keeps speed when friction is disabled', () => {
  let s = createSwinger([0, 1, 0], [10, 0, 0], DT);
  for (let i = 0; i < 60; i++) s = step(s, DT, { friction: false });
  assert.ok(velocity(s, DT)[0] > 9); // only ~5% air drag over 0.5 s
  let t = createSwinger([0, 1, 0], [10, 0, 0], DT);
  for (let i = 0; i < 60; i++) t = step(t, DT);
  assert.ok(velocity(t, DT)[0] < 1, 'default ground friction still stops sliding');
});

test('landing on a roof reports grounded with the roof height', () => {
  const tower = { x: 0, z: 0, w: 10, d: 10, h: 40 };
  let s = createSwinger([0, 45, 0], [0, -5, 0], DT);
  for (let i = 0; i < 120; i++) s = step(s, DT, { towers: [tower] });
  assert.equal(s.grounded, true);
  assert.equal(s.groundY, 40);
});
