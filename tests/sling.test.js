import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickSlingPair, slingPhase, slingLaunch, jumpSpeed, jumpCharge, leftOf, SLINGSHOT, JUMP } from '../src/physics/sling.js';
import { SWING } from '../src/physics/swinger.js';

const street = [
  // a north-south street at x = 0: buildings either side
  { x: -20, z: -40, w: 12, d: 18, h: 60 },
  { x: 20, z: -40, w: 12, d: 18, h: 70 },
  { x: -20, z: 40, w: 12, d: 18, h: 50 },
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test('leftOf follows the rig convention (+X is left when facing +Z)', () => {
  assert.deepEqual(leftOf([0, 0, 1]), [1, 0, -0]);
});

test('slingshot anchors land on a building on each side, above the hero', () => {
  const pos = [0, 1.5, 0];
  const heading = [0, 0, -1];
  const pair = pickSlingPair(pos, heading, street);
  assert.ok(pair, 'expected a pair');
  const left = leftOf(heading);
  assert.ok(dot([pair.L[0] - pos[0], 0, pair.L[2] - pos[2]], left) > 0, 'L anchor on the left');
  assert.ok(dot([pair.R[0] - pos[0], 0, pair.R[2] - pos[2]], left) < 0, 'R anchor on the right');
  assert.ok(pair.L[1] > pos[1] + 3 && pair.R[1] > pos[1] + 3);
});

test('no slingshot when one side has nothing to grab', () => {
  assert.equal(pickSlingPair([0, 1.5, 0], [0, 0, -1], [street[0]]), null);
});

test('slingshot phases: lines fly out, stretch back, then launch', () => {
  assert.equal(slingPhase(0).phase, 'fire');
  assert.equal(slingPhase(SLINGSHOT.fire + 0.1).phase, 'load');
  assert.equal(slingPhase(SLINGSHOT.fire + SLINGSHOT.load + 0.01).phase, 'launch');
  let prev = -1;
  for (let t = 0; t < 0.7; t += 0.01) {
    const s = slingPhase(t).stretch;
    assert.ok(s >= prev - 1e-12);
    prev = s;
  }
});

test('the slingshot launches up and forward hard enough to start swinging', () => {
  const pos = [0, 1.5, 0];
  const heading = [0, 0, -1];
  const v = slingLaunch(pos, heading, { L: [-8, 40, -30], R: [8, 40, -30] });
  assert.ok(v[1] > 20, `vertical ${v[1]}`);
  assert.ok(dot(v, heading) > 25, 'forward');
  const apex = (v[1] * v[1]) / (2 * SWING.gravity);
  assert.ok(apex > 12, `apex ${apex} m`);
});

test('a tapped jump hops, a held jump charges up to a super jump', () => {
  assert.equal(jumpSpeed(0.05), JUMP.tap);
  assert.ok(jumpSpeed(0.5) > JUMP.tap && jumpSpeed(0.5) < JUMP.max);
  assert.equal(jumpSpeed(5), JUMP.max);
  let prev = 0;
  for (let h = 0; h < 2; h += 0.02) {
    assert.ok(jumpSpeed(h) >= prev);
    prev = jumpSpeed(h);
  }
  const fullHeight = (JUMP.max * JUMP.max) / (2 * SWING.gravity);
  assert.ok(fullHeight > 35, `full charge only reaches ${fullHeight} m`);
  assert.equal(jumpCharge(0), 0);
  assert.equal(jumpCharge(10), 1);
});

import { pickSwingAnchor, desiredDirection } from '../src/physics/anchors.js';

const canyon = [
  { x: -22, z: -60, w: 12, d: 30, h: 90 },
  { x: 22, z: -60, w: 12, d: 30, h: 80 },
  { x: -22, z: 60, w: 12, d: 30, h: 90 }, // behind the hero
];

test('auto swing anchors land ahead and above, on a flanking building', () => {
  const pos = [0, 30, 0];
  const a = pickSwingAnchor(pos, [0, 0, -20], [0, 0, -1], canyon);
  assert.ok(a, 'expected an anchor');
  assert.ok(a.point[2] < -3, 'ahead of the hero');
  assert.ok(a.point[1] > pos[1] + 7, 'above the hero');
  assert.ok(Math.abs(a.point[0]) >= 10, 'on a building face beside the street');
});

test('auto swing follows the wanted direction, not the camera', () => {
  const pos = [0, 30, 0];
  const back = pickSwingAnchor(pos, [0, 0, 0], [0, 0, 1], canyon);
  assert.ok(back && back.point[2] > 3, 'turned around: anchors on the building behind');
  assert.equal(pickSwingAnchor(pos, [0, 0, 0], [1, 0, 0], [canyon[2]]), null, 'nothing that way → no line');
});

test('the side of the anchor picks the hand', () => {
  const a = pickSwingAnchor([0, 30, 0], [0, 0, -20], [0, 0, -1], [canyon[0]]); // building on the -x side
  // facing -z, left is -x: a building at -x is on the hero's left
  assert.equal(a.side, 'L');
});

test('desired direction comes from WASD relative to the heading, or keeps the momentum', () => {
  const h = [0, 0, -1];
  assert.deepEqual(desiredDirection(h, { f: true }, [0, 0, 0]), [0, 0, -1]);
  const left = desiredDirection(h, { l: true }, [0, 0, 0]);
  assert.ok(left[0] < -0.99, 'A steers left (-x when facing -z)');
  const diag = desiredDirection(h, { f: true, r: true }, [0, 0, 0]);
  assert.ok(diag[0] > 0.4 && diag[2] < -0.6);
  assert.deepEqual(desiredDirection(h, {}, [10, 0, 0]), [1, 0, 0]);
});
