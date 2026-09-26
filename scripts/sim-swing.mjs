import { generateTowers } from '../src/core/layout.js';
import { simulateSwingPath } from '../src/physics/swingPath.js';
const towers = generateTowers(1);
console.log('towers', towers.length);
const s = simulateSwingPath(towers);
let minY = 1e9, maxX = -1e9, minX = 1e9, attaches = 0, prevA = null, maxSp = 0;
for (const x of s) { minY = Math.min(minY, x.pos[1]); minX = Math.min(minX, x.pos[0]); maxX = Math.max(maxX, x.pos[0]);
  const sp = Math.hypot(...x.vel); maxSp = Math.max(maxSp, sp);
  if (x.anchor && (!prevA || prevA[0] !== x.anchor[0] || prevA[2] !== x.anchor[2])) attaches++; prevA = x.anchor; }
const last = s[s.length - 1];
console.log({ samples: s.length, dur: last.t.toFixed(2), minY: minY.toFixed(1), minX: minX.toFixed(1), maxX: maxX.toFixed(1), attaches, maxSp: maxSp.toFixed(1), end: last.pos.map(v => v.toFixed(1)) });
for (let i = 0; i < s.length; i += 15) console.log(s[i].t.toFixed(1), s[i].pos.map(v => v.toFixed(0)).join(','), s[i].anchor ? 'A'+s[i].anchor.map(v=>v.toFixed(0)) : '-', Math.hypot(...s[i].vel).toFixed(0));
