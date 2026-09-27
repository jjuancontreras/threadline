import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPedSim, buildSidewalks, PED } from '../src/scenes/pedSim.js';
import { signalGreen, SIGNAL } from '../src/scenes/streetSim.js';
import { STREETS } from '../src/core/layout.js';

const onRoad = (walk, s) => walk.roads.some(([a, b]) => s > a && s < b);

test('sidewalks sit outside the road edge on both sides of every street', () => {
  const walks = buildSidewalks();
  assert.equal(walks.length, 2 + STREETS.alongX.length * 2 + STREETS.crossZ.length * 2);
  for (const w of walks) assert.ok(w.roads.length > 0, `sidewalk ${w.axis}@${w.c} crosses no roads`);
});

test('nobody spawns standing in the road', () => {
  const sim = createPedSim(1500);
  for (const p of sim.people) assert.ok(!onRoad(p.walk, p.s), 'spawned on a crosswalk');
});

test('walkers never step onto a crosswalk once their phase has been red for a second', () => {
  const sim = createPedSim(1500);
  const prev = new Map(sim.people.map((p) => [p, p.s]));
  let steps = 0;
  for (let i = 1; i <= 1200; i++) {
    const t = i * 0.05;
    sim.step(0.05, t);
    for (const p of sim.people) {
      const before = prev.get(p);
      prev.set(p, p.s);
      if (Math.abs(p.s - before) > 1) continue; // wrapped at the extent
      const entered = !onRoad(p.walk, before) && onRoad(p.walk, p.s);
      if (entered) {
        // a walker already stepping off the kerb when the light changes carries on (amber grace)
        assert.ok(signalGreen(p.walk.axis, t) || signalGreen(p.walk.axis, t - 1), `entered on red at t=${t}`);
        steps++;
      }
    }
  }
  assert.ok(steps > 50, `only ${steps} crossings observed`);
});

test('people queue at the kerb during the red phase', () => {
  const sim = createPedSim(1500);
  const t0 = SIGNAL.xGreen[0] + 6; // z-axis walkers are red here
  for (let t = 0.05; t <= t0; t += 0.05) sim.step(0.05, t);
  const waiting = sim.people.filter((p) => p.walk.axis === 'z' && !p.idle && p.v < 0.2).length;
  assert.ok(waiting > 20, `only ${waiting} waiting`);
});

test('scatter sends nearby people running away and leaves distant ones alone', () => {
  const sim = createPedSim(1500);
  const center = [17, 0, -37];
  const near = sim.people.filter((p) => {
    const [x, z] = sim.position(p);
    return Math.hypot(x - center[0], z - center[2]) < 40;
  });
  const far = sim.people.find((p) => {
    const [x, z] = sim.position(p);
    return Math.hypot(x - center[0], z - center[2]) > 200;
  });
  const d0 = new Map(near.map((p) => [p, Math.hypot(...[sim.position(p)[0] - center[0], sim.position(p)[1] - center[2]])]));
  const n = sim.scatter(center, 40, 10);
  assert.equal(n, near.length);
  assert.equal(far.flee, 0);
  for (let t = 0.05; t <= 3; t += 0.05) sim.step(0.05, 100 + t);
  const fartherNow = near.filter((p) => {
    const [x, z] = sim.position(p);
    return Math.hypot(x - center[0], z - center[2]) > d0.get(p);
  }).length;
  assert.ok(fartherNow >= near.length * 0.9, `${fartherNow}/${near.length} moved away`);
  assert.ok(near.every((p) => p.v > PED.speed[1]), 'panicked people should run');
});

test('positions stay finite and inside the street extents', () => {
  const sim = createPedSim(800);
  for (let i = 1; i <= 2000; i++) sim.step(0.1, i * 0.1);
  for (const p of sim.people) {
    const [x, z] = sim.position(p);
    assert.ok(Number.isFinite(x) && Number.isFinite(z));
    assert.ok(p.s >= p.walk.min - 1e-6 && p.s <= p.walk.max + 1e-6);
  }
});
