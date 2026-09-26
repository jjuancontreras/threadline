import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextDowngrade, MIN_DPR, createMonitor } from '../src/core/quality.js';

test('downgrade ladder steps DPR to 1, then post off, then sub-native DPR, then sheds extras', () => {
  // Arrange
  let s = { dpr: 2, post: true, shed: false };
  const seen = [];
  // Act
  for (let next = nextDowngrade(s); next; next = nextDowngrade(s)) {
    seen.push(next);
    s = next;
  }
  // Assert
  assert.deepEqual(seen, [
    { dpr: 1.5, post: true, shed: false },
    { dpr: 1, post: true, shed: false },
    { dpr: 1, post: false, shed: false },
    { dpr: MIN_DPR, post: false, shed: false },
    { dpr: MIN_DPR, post: false, shed: true },
  ]);
});

test('downgrade returns a new object and leaves the input untouched', () => {
  const s = Object.freeze({ dpr: 1, post: true, shed: false });
  const next = nextDowngrade(s);
  assert.notEqual(next, s);
  assert.equal(s.post, true);
});

test('monitor ignores the warm-up and only downgrades after sustained low FPS', () => {
  // Arrange
  const calls = [];
  const m = createMonitor({ mobile: false, post: true, locked: false }, 1, (s) => calls.push(s));
  // Act: 3 s warm-up at 10 fps, then 1 s slow — not yet past patience
  for (let t = 0; t < 4; t += 0.1) m.tick(0.1);
  const early = calls.length;
  for (let t = 0; t < 4; t += 0.1) m.tick(0.1);
  // Assert
  assert.equal(early, 0);
  assert.deepEqual(calls[0], { dpr: 1, post: false, shed: false });
});

test('a locked quality tier never downgrades', () => {
  const calls = [];
  const m = createMonitor({ mobile: false, post: true, locked: true }, 2, (s) => calls.push(s));
  for (let t = 0; t < 20; t += 0.1) m.tick(0.1);
  assert.equal(calls.length, 0);
});
