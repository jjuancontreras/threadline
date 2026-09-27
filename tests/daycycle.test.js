import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skyAt, skyAtTime, DAY } from '../src/core/daycycle.js';

test('one full cycle takes four minutes', () => {
  assert.equal(DAY.period, 240);
  const a = skyAtTime(10);
  const b = skyAtTime(10 + 240);
  assert.ok(Math.abs(a.phase - b.phase) < 1e-9);
});

test('noon is full daylight with the lights off; midnight is dark with the lights on', () => {
  const noon = skyAt(0.25);
  assert.ok(noon.day > 0.99 && noon.lights < 0.01 && noon.sunDir[1] > 0.9);
  const midnight = skyAt(0.75);
  assert.ok(midnight.day < 0.01 && midnight.lights > 0.99 && midnight.sunDir[1] < -0.9);
  assert.ok(midnight.moonDir[1] > 0.2, 'the moon is up at night');
});

test('sunrise and sunset glow golden; noon and midnight do not', () => {
  assert.ok(skyAt(0.01).golden > 0.5, 'sunrise');
  assert.ok(skyAt(0.49).golden > 0.5, 'sunset');
  assert.ok(skyAt(0.25).golden < 0.01);
  assert.ok(skyAt(0.75).golden < 0.01);
});

test('the sky changes smoothly (no frame-to-frame jumps over a whole day)', () => {
  let prev = skyAt(0);
  for (let p = 0.001; p <= 1; p += 0.001) {
    const s = skyAt(p);
    for (const k of ['day', 'golden', 'lights']) assert.ok(Math.abs(s[k] - prev[k]) < 0.03, `${k} jumps at ${p}`);
    prev = s;
  }
});

test('sun and moon directions are unit vectors', () => {
  for (let p = 0; p < 1; p += 0.05) {
    const s = skyAt(p);
    assert.ok(Math.abs(Math.hypot(...s.sunDir) - 1) < 1e-9);
    assert.ok(Math.abs(Math.hypot(...s.moonDir) - 1) < 1e-9);
  }
});

test('free mode starts before dawn so the first sunrise comes within a minute', () => {
  const s = skyAtTime(0);
  assert.ok(s.lights > 0.9, 'starts dark');
  let t = 0;
  while (skyAtTime(t).day < 0.5 && t < 240) t += 1;
  assert.ok(t < 60, `sunrise took ${t}s`);
});
