// Dev helper: parked-camera review shots (needs a build; uses the ?debug fixed camera).
// Usage: node scripts/review-shots.mjs '[{"name":"x","goto":[chapter,p],"cam":{"pos":[..],"look":[..]},"wait":ms}]'
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { serveDist } from './lib/serve.mjs';
const OUT = resolve('verify/screenshots/review');
await mkdir(OUT, { recursive: true });
const server = await serveDist();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`${server.origin}/?q=high&debug`);
await page.waitForFunction(() => window.__threadline?.ready);
await page.addStyleTag({ content: '.overlay, .caption { visibility: hidden !important; }' });
const shots = JSON.parse(process.argv[2] || '[]');
for (const s of shots) {
  if (s.goto) await page.evaluate((g) => window.__threadline.goto(...g), s.goto);
  await page.evaluate((c) => (window.__threadline.debug.fixed = c), s.cam || null);
  await sleep(s.wait ?? 2500);
  await page.screenshot({ path: join(OUT, s.name + '.png') });
}
console.log('errors', errs);
await browser.close();
await server.close();
