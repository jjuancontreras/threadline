import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signalGreen, SIGNAL, buildLanes, createTrafficSim, idm, CAR } from '../src/scenes/streetSim.js';

test('the two signal phases never overlap and each gets a green', () => {
  let z = 0;
  let x = 0;
  for (let t = 0; t < SIGNAL.cycle; t += 0.05) {
    const gz = signalGreen('z', t);
    const gx = signalGreen('x', t);
    assert.ok(!(gz && gx), `both green at t=${t}`);
    z += gz;
    x += gx;
  }
  assert.ok(z > 0 && x > 0);
});

test('signalGreen handles negative and very large times', () => {
  assert.equal(signalGreen('z', -SIGNAL.cycle + 1), signalGreen('z', 1));
  assert.equal(signalGreen('x', SIGNAL.cycle * 1000 + 10), signalGreen('x', 10));
});

test('every lane has increasing stop lines inside its span', () => {
  for (const lane of buildLanes()) {
    assert.ok(lane.stops.length > 0, `lane ${lane.axis}@${lane.c} has no crossings`);
    for (let i = 0; i < lane.stops.length; i++) {
      const s = lane.stops[i];
      assert.ok(s.u > 0 && s.clear < lane.span && s.clear > s.u);
      if (i) assert.ok(s.u > lane.stops[i - 1].u);
    }
  }
});

test('IDM brakes hard for a stopped obstacle close ahead and cruises on an open road', () => {
  assert.ok(idm(12, 12, 5, 0) < -3);
  assert.ok(Math.abs(idm(12, 12, Infinity, 0)) < 1e-9);
  assert.ok(idm(0, 12, Infinity, 0) > 0);
});

test('cars never overlap or reverse over two minutes of simulated traffic', () => {
  const sim = createTrafficSim(320);
  for (let i = 0; i < 1200; i++) {
    sim.step(0.1, i * 0.1 + 0.1);
    for (const lane of sim.lanes) {
      const list = lane.cars;
      for (let k = 0; k + 1 < list.length; k++) {
        assert.ok(list[k + 1].u - list[k].u > CAR.length * 0.9, `overlap at step ${i}`);
      }
    }
    for (const c of sim.cars) assert.ok(c.v >= 0);
  }
});

test('traffic keeps flowing: average speed stays well above zero', () => {
  const sim = createTrafficSim(320);
  let sum = 0;
  let n = 0;
  for (let i = 0; i < 600; i++) {
    sim.step(0.1, i * 0.1 + 0.1);
    if (i > 200) for (const c of sim.cars) (sum += c.v), n++;
  }
  assert.ok(sum / n > 3, `mean speed ${sum / n}`);
});

test('cars wait at red lights: none enters a crossing box while its phase is red (except committed ones)', () => {
  const sim = createTrafficSim(320);
  let entered = 0;
  let checks = 0;
  const prev = new Map(sim.cars.map((c) => [c.id, c.u]));
  for (let i = 0; i < 900; i++) {
    const t = i * 0.1 + 0.1;
    sim.step(0.1, t);
    for (const c of sim.cars) {
      const before = prev.get(c.id);
      prev.set(c.id, c.u);
      if (signalGreen(c.lane.axis, t) || signalGreen(c.lane.axis, t - 3) || c.u < before) continue;
      for (const s of c.lane.stops) {
        // a car whose front crossed the stop line this frame, well into a red phase
        const f0 = before + CAR.length / 2;
        const f1 = c.u + CAR.length / 2;
        if (f0 < s.u && f1 >= s.u) entered++;
      }
      checks++;
    }
  }
  assert.ok(checks > 1000);
  assert.equal(entered, 0);
});

test('cars stop at red lights and queue behind the stop line', () => {
  const sim = createTrafficSim(320);
  // run into the middle of an x-green phase: z-axis traffic is red
  const t0 = SIGNAL.xGreen[0] + 5;
  for (let t = 0.1; t <= t0 + SIGNAL.cycle * 2; t += 0.1) sim.step(0.1, t);
  const stopped = sim.cars.filter((c) => c.lane.axis === 'z' && c.v < 0.3).length;
  assert.ok(stopped > 10, `only ${stopped} cars waiting`);
});
