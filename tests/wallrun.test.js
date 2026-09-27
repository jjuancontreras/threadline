import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enterWall, stepWall, wallJump, faceNormal, faceRight, WALL } from '../src/physics/wallrun.js';

const tower = { x: 0, z: 0, w: 10, d: 8, h: 60 };
const run = (w, input, seconds, dt = 1 / 120) => {
  let cur = w;
  let last = null;
  for (let t = 0; t < seconds; t += dt) {
    const r = stepWall(cur, input, dt);
    last = r;
    if (!r.w) return r;
    cur = r.w;
  }
  return { ...last, w: cur };
};
const onPlane = (w) => {
  const off = (w.n[0] !== 0 ? tower.w : tower.d) + WALL.standOff;
  const d = w.n[0] !== 0 ? (w.pos[0] - tower.x) * w.n[0] : (w.pos[2] - tower.z) * w.n[2];
  return Math.abs(d - off) < 1e-6;
};

test('face normal points out of the side the hero touched', () => {
  assert.deepEqual(faceNormal(tower, [0, 5, 9]), [0, 0, 1]);
  assert.deepEqual(faceNormal(tower, [-11, 5, 1]), [-1, 0, 0]);
  assert.deepEqual(faceRight([0, 0, 1]), [1, 0, 0]);
});

test('running up the wall from the street climbs to the roof and vaults onto it', () => {
  const w = enterWall(tower, [2, 1.2, 8.7], [0, 0, -12], { climb: 14 });
  assert.equal(w.mode, 'climb');
  const r = run(w, { up: 1, side: 0, fast: true }, 10);
  assert.equal(r.event, 'vault');
  assert.ok(r.exit.pos[1] > tower.h, 'lands above the roof');
  assert.ok(Math.abs(r.exit.pos[2] - tower.z) < tower.d, 'lands on the roof, inside the ledge');
});

test('the hero stays on the facade plane while moving around', () => {
  let w = enterWall(tower, [0, 20, 8.7], [0, 0, -5]);
  for (const input of [{ up: 1, side: 0 }, { up: 0, side: 1 }, { up: -1, side: -1 }, { up: 0.3, side: 1 }]) {
    for (let i = 0; i < 60; i++) {
      const r = stepWall(w, { ...input, fast: false }, 1 / 60);
      if (!r.w) break;
      w = r.w;
      assert.ok(onPlane(w), 'left the facade');
    }
  }
});

test('running sideways off an edge wraps around the corner onto the next face', () => {
  const w = enterWall(tower, [8, 20, 8.7], [0, 0, -5]);
  const r = run(w, { up: 0, side: 1, fast: true }, 0.6);
  assert.ok(r.w, 'still on the wall');
  assert.deepEqual(r.w.n, [1, 0, 0], 'moved onto the +x face');
  assert.ok(onPlane(r.w));
});

test('a fast glancing contact becomes a horizontal wall-run that keeps its speed', () => {
  const w = enterWall(tower, [-6, 30, 8.7], [22, 2, -3]);
  assert.equal(w.mode, 'hrun');
  const r = run(w, { up: 0, side: 0, fast: false }, 0.5);
  assert.ok(Math.abs(r.w.v[0]) > 15, `slowed to ${r.w.v[0]}`);
  assert.ok(r.w.pos[1] < 30 && r.w.pos[1] > 28, 'sags only slightly');
});

test('descending to the street steps off the wall', () => {
  const w = enterWall(tower, [0, 3, 8.7], [0, -2, -3]);
  const r = run(w, { up: -1, side: 0, fast: false }, 3);
  assert.equal(r.event, 'ground');
});

test('a wall jump kicks away from the face and upward', () => {
  const w = enterWall(tower, [0, 20, 8.7], [0, 0, -5]);
  const j = wallJump(w);
  assert.ok(j.vel[2] > 10 && j.vel[1] > 10);
});
