import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModes } from '../src/core/modes.js';

function setup() {
  const log = [];
  let saved = false;
  const scroll = { lock: (on) => log.push(['lock', on]), goto: (...a) => log.push(['goto', ...a]) };
  const hud = { saved: () => {}, freeSwingHint: () => {} };
  const free = { enter: () => log.push(['enter']), exit: () => log.push(['exit']) };
  const html = { dataset: {}, classList: { add: () => {}, remove: () => {} } };
  const modes = createModes({ scroll, hud, free, html, hooks: {}, isSaved: () => saved });
  modes.bindNav({ unlockFree: () => {}, setFreeActive: () => {} });
  return { modes, log, save: () => (saved = true) };
}

test('reaching chapter 5 before the save latches and locks the scroll on the rescue', () => {
  const { modes, log } = setup();
  const r = modes.resolve(4, 0.3);
  assert.deepEqual(r, { index: 4, p: 0.002 });
  assert.deepEqual(log.at(-1), ['lock', true]);
  // later frames stay pinned even if scroll reports something else
  assert.deepEqual(modes.resolve(5, 0.5), { index: 4, p: 0.002 });
});

test('the latch releases once the train is saved', () => {
  const { modes, save } = setup();
  modes.resolve(4, 0.1);
  save();
  assert.deepEqual(modes.resolve(5, 0.2), { index: 5, p: 0.2 });
});

test('jumping to another chapter from the rail unlatches and unlocks', () => {
  const { modes, log } = setup();
  modes.resolve(4, 0.1);
  modes.gotoChapter(1);
  assert.ok(log.some(([k, v]) => k === 'lock' && v === false));
  assert.deepEqual(modes.resolve(1, 0.001), { index: 1, p: 0.001 });
});

test('free swing stays locked until the train is saved', () => {
  const { modes, log } = setup();
  modes.enterFree();
  assert.equal(modes.freeOn, false);
  modes.onSaved();
  modes.enterFree();
  assert.equal(modes.freeOn, true);
  assert.ok(log.some(([k]) => k === 'enter'));
  modes.toggleFree();
  assert.equal(modes.freeOn, false);
});
