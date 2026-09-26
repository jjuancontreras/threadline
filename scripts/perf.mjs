// Smoothness probe: wheel-scrolls through chapter 2 and free swing, recording every rAF frame.
// Reports FPS, frame-time p95, and "jerk" = how uneven per-frame hero/camera motion is.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const ROOT = resolve('dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const p = new URL(req.url, 'http://x').pathname;
    const f = join(ROOT, p === '/' ? 'index.html' : p);
    res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
    res.end(await readFile(f));
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(4319);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] }); // match desktop Chrome on Windows
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4319/?q=high');
await page.waitForFunction(() => window.__threadline?.ready);
await sleep(1500);

const record = () =>
  page.evaluate(() => {
    const t = window.__threadline;
    window.__rec = [];
    const tick = (now) => {
      window.__rec.push({ now, hero: [...(t.heroPos || [0, 0, 0])], cam: [...(t.camPos || [0, 0, 0])], ch: t.chapter });
      if (window.__rec.length < 100000) window.__recId = requestAnimationFrame(tick);
    };
    window.__recId = requestAnimationFrame(tick);
  });
const stop = () => page.evaluate(() => (cancelAnimationFrame(window.__recId), window.__rec));

function analyse(label, rec) {
  const dts = rec.slice(1).map((r, i) => r.now - rec[i].now);
  const sorted = [...dts].sort((a, b) => a - b);
  const step = (key) => rec.slice(1).map((r, i) => Math.hypot(...r[key].map((v, k) => v - rec[i][key][k])));
  // jerk: mean |Δstep| relative to mean step (0 = perfectly even motion)
  const jerk = (s) => {
    const moving = s.filter((v) => v > 1e-3);
    const mean = moving.reduce((a, b) => a + b, 0) / Math.max(moving.length, 1);
    const d = s.slice(1).map((v, i) => Math.abs(v - s[i]));
    return (d.reduce((a, b) => a + b, 0) / Math.max(d.length, 1)) / (mean || 1);
  };
  const avg = dts.reduce((a, b) => a + b, 0) / dts.length;
  console.log(
    `${label.padEnd(12)} frames=${rec.length} fps=${(1000 / avg).toFixed(1)} p95=${sorted[Math.floor(sorted.length * 0.95)].toFixed(1)}ms ` +
      `max=${sorted[sorted.length - 1].toFixed(1)}ms heroJerk=${jerk(step('hero')).toFixed(3)} camJerk=${jerk(step('cam')).toFixed(3)}`,
  );
}

// 1) wheel-scroll through the swing chapter
await page.evaluate(() => window.__threadline.goto(1, 0.02));
await sleep(1200);
await record();
for (let i = 0; i < 60; i++) {
  await page.mouse.wheel(0, 140);
  await sleep(60);
}
await sleep(800);
analyse('swing-scroll', await stop());

// 2) free swing with held tethers
await page.evaluate(() => window.__threadline.goto(4, 0.01));
await page.waitForFunction(() => window.__threadline.rescue === 'saved', null, { timeout: 60000 });
await page.keyboard.press('f');
await sleep(500);
await record();
for (let i = 0; i < 4; i++) {
  await page.mouse.move(720 + (i % 2 ? 200 : -200), 270);
  await page.mouse.down();
  await sleep(1100);
  await page.mouse.up();
  await sleep(400);
}
analyse('free-swing', await stop());
await browser.close();
server.close();
