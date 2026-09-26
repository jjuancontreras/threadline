// Dev helper: close-up turnaround of THREADRUNNER's suit in a few story poses.
// Writes verify/screenshots/hero/*.png. Needs a build (uses ?debug camera override).
import { chromium } from 'playwright';
import { serveDist } from './lib/serve.mjs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const OUT = resolve('verify/screenshots/hero');
const server = await serveDist();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
await page.goto(`${server.origin}/?q=high&debug`);
await page.waitForFunction(() => window.__threadline?.ready);
await page.addStyleTag({ content: '.overlay, .caption { visibility: hidden !important; }' });

const poses = [
  { name: 'perch', chapter: 0, p: 0.8 },
  { name: 'swing', chapter: 1, p: 0.3 },
  { name: 'trick', chapter: 1, p: 'trick' },
  { name: 'rescue-brace', chapter: 4, p: 0.01, wait: 11000 },
];
const views = [
  { name: 'front', yaw: 0 },
  { name: 'three-quarter', yaw: 0.8 },
  { name: 'back', yaw: Math.PI },
];
for (const pose of poses) {
  const p = pose.p === 'trick' ? (await page.evaluate(() => window.__threadline.trickMoments()))[1] : pose.p;
  await page.evaluate(({ c, p }) => window.__threadline.goto(c, p), { c: pose.chapter, p });
  await sleep(pose.wait ?? 1500);
  for (const v of views) {
    // yaw relative to the hero's facing
    await page.evaluate(({ yaw }) => {
      const t = window.__threadline;
      const root = t.debug.world.hero.root;
      const facing = root.position.clone().set(0, 0, 1).applyQuaternion(root.quaternion); // +Z = front
      t.debug.cam = { dist: 3.6, yaw: Math.atan2(facing.x, facing.z) + yaw, height: 0.6 };
    }, { yaw: v.yaw });
    await sleep(400);
    await page.screenshot({ path: join(OUT, `${pose.name}-${v.name}.png`) });
  }
  await page.evaluate(() => (window.__threadline.debug.cam = null));
}
await browser.close();
await server.close();
console.log('hero shots written to', OUT);
