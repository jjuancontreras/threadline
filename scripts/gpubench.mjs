// GPU cost benchmark: renders the current frame N times with a readPixels sync and reports
// the median ms per frame — immune to rAF/vsync/compositor noise. Needs a `?debug` build hook.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const ROOT = resolve('dist');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (q, s) => {
  try {
    const p = new URL(q.url, 'http://x').pathname;
    const f = join(ROOT, p === '/' ? 'index.html' : p);
    s.writeHead(200, { 'Content-Type': T[extname(f)] || 'application/octet-stream' });
    s.end(await readFile(f));
  } catch {
    s.writeHead(404);
    s.end();
  }
}).listen(4323);

const SHOTS = [[0, 0.5], [1, 0.5], [2, 0.8], [3, 0.5], [4, 0.01]];
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', ...(process.env.ANGLE ? [`--use-angle=${process.env.ANGLE}`] : [])] });
for (const q of process.argv.slice(2).length ? process.argv.slice(2) : ['high', 'low']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:4323/?q=${q}&debug`);
  await page.waitForFunction(() => window.__threadline?.ready);
  await new Promise((r) => setTimeout(r, 1200));
  const row = [];
  for (const [c, p] of SHOTS) {
    await page.evaluate(([c, p]) => window.__threadline.goto(c, p), [c, p]);
    await new Promise((r) => setTimeout(r, 900));
    const ms = await page.evaluate(() => {
      const { stage } = window.__threadline.debug;
      const gl = stage.renderer.getContext();
      const px = new Uint8Array(4);
      const times = [];
      for (let i = 0; i < 12; i++) {
        const t0 = performance.now();
        stage.render(0.016);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      return times[6];
    });
    row.push(`ch${c + 1} ${ms.toFixed(1).padStart(6)}ms`);
  }
  console.log(`q=${q.padEnd(6)} ${row.join('  ')}`);
  await page.close();
}
await browser.close();
server.close();
