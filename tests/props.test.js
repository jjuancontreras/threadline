import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streetLamps, barrelClusters, craneSites, pipeEnds, CRANE } from '../src/scenes/propLayout.js';
import { pipeMove, poleMove, PIPE } from '../src/scenes/free/moves.js';
import { generateTowers, STREETS } from '../src/core/layout.js';

const towers = generateTowers(1);
const inTower = (p, pad = 0) => towers.some((t) => Math.abs(p[0] - t.x) < t.w + pad && Math.abs(p[2] - t.z) < t.d + pad && p[1] < t.h);
const run = (move, dt = 1 / 60, max = 5) => {
  let f;
  for (let t = 0; t < max; t += dt) {
    f = move.step(dt);
    if (f.done) return f;
  }
  return f;
};

test('street lamps stand on the pavement, never in the road or inside a building', () => {
  const lamps = streetLamps(towers);
  assert.ok(lamps.length > 200, `only ${lamps.length} lamps`);
  const lineDist = (c, o) => Math.abs((((c - o) / STREETS.period + 0.5) % 1 + 1) % 1 - 0.5) * STREETS.period;
  for (const l of lamps) {
    const inRoad = lineDist(l.x, STREETS.offsetX) < STREETS.halfWidth || lineDist(l.z, STREETS.offsetZ) < STREETS.halfWidth || Math.abs(l.x) < 20;
    assert.ok(!inRoad, `lamp in the road at ${l.x},${l.z}`);
    assert.ok(Math.hypot(...l.arm) > 0.99);
  }
  const blocked = lamps.filter((l) => inTower([l.x, 1, l.z])).length;
  assert.equal(blocked, 0, `${blocked} lamps inside towers`);
});

test('barrel clusters sit on roofs and bring a collider', () => {
  const clusters = barrelClusters(towers);
  assert.ok(clusters.length > 5);
  for (const c of clusters) assert.ok(c.collider.h > c.roof && c.n >= 3);
});

test('cranes stand on roofs with the hanging pipe clear of every building', () => {
  const sites = craneSites(towers);
  assert.equal(sites.length, 3);
  for (const s of sites) {
    const e = pipeEnds(s);
    for (const p of [e.a, e.b, e.center]) assert.ok(!inTower(p, 1), 'pipe inside a building');
    assert.ok(Math.abs(Math.hypot(e.b[0] - e.a[0], e.b[2] - e.a[2]) - CRANE.pipeLength) < 1e-6);
  }
});

test('the pipe run enters the nearer mouth and exits the far one at speed along the bore', () => {
  const site = craneSites(towers)[0];
  const ends = () => pipeEnds(site);
  const e = ends();
  const start = [e.a[0] - e.axis[0] * 10, e.a[1] - 3, e.a[2] - e.axis[2] * 10];
  const f = run(pipeMove(start, ends));
  assert.ok(f.done, 'pipe run never finished');
  assert.ok(Math.hypot(f.exit.pos[0] - e.b[0], f.exit.pos[2] - e.b[2]) < 3, 'did not come out of the far mouth');
  const along = f.exit.vel[0] * e.axis[0] + f.exit.vel[2] * e.axis[2];
  assert.ok(along > PIPE.exitSpeed * 0.95, `exit speed along the pipe ${along}`);
});

test('the pole whirl circles the pole and releases along the heading, upward', () => {
  const pole = { x: 10, z: -20, base: 0, top: 7.4 };
  for (const heading of [[0, 0, -1], [1, 0, 0], [-0.6, 0, 0.8]]) {
    const start = [pole.x - heading[0] * 2 + heading[2] * 1.5, 1.5, pole.z - heading[2] * 2 - heading[0] * 1.5];
    const move = poleMove(start, heading, pole);
    let maxR = 0;
    let f;
    for (let t = 0; t < 3; t += 1 / 60) {
      f = move.step(1 / 60);
      if (t > 0.2) maxR = Math.max(maxR, Math.abs(Math.hypot(f.pos[0] - pole.x, f.pos[2] - pole.z) - 1.35));
      if (f.done) break;
    }
    assert.ok(f.done);
    assert.ok(maxR < 0.05, 'left the circle around the pole');
    const v = f.exit.vel;
    const flat = Math.hypot(v[0], v[2]);
    assert.ok((v[0] * heading[0] + v[2] * heading[2]) / flat > 0.97, `released off-heading ${heading}`);
    assert.ok(v[1] > 10, 'no lift on release');
  }
});
