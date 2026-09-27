// THREADLINE verification: serves dist/, drives the story with Playwright at two viewports,
// normal + reduced motion, saves screenshots and fails on any console/page error.
import { chromium } from 'playwright';
import { serveDist } from './lib/serve.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const OUT = resolve('verify/screenshots');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, query: '?q=high', mobile: false },
  { name: 'mobile', width: 390, height: 844, query: '', mobile: true },
];
const SHOTS = [
  { chapter: 0, p: 0.8, file: '1-perch' },
  { chapter: 1, p: 0.52, file: '2-swing' },
  { chapter: 1, p: 'trick', file: '2b-swing-trick', extra: true },
  { chapter: 2, p: 0.035, file: '3b-threat-slingshot', extra: true },
  { chapter: 2, pre: 0.5, p: 0.535, file: '3-threat' },
  { chapter: 2, p: 0.66, file: '3c-threat-carrier', extra: true },
  { chapter: 3, pre: 0.62, p: 0.745, file: '4-impact' },
];


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hook = (page, expr) => page.evaluate(`(() => { const t = window.__threadline; return ${expr}; })()`);

async function waitFor(page, expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await hook(page, expr).catch(() => false)) return Date.now() - t0;
    await sleep(200);
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function scrollThrough(page, vp) {
  // real wheel/scroll input through all chapters to prove the scroll driver works
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    if (vp.mobile) await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.9));
    else await page.mouse.wheel(0, 900);
    await sleep(120);
    seen.add(await hook(page, 't.chapter'));
    if (seen.has(3)) break;
  }
  return [...seen].sort();
}

async function touchHold(page, client, x, y, ms) {
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await sleep(ms);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function freeSwing(page, vp) {
  await page.keyboard.press('f');
  await waitFor(page, 't.freeActive === true', 5000, 'free swing mode');
  const start = await hook(page, 't.free.distance');
  const client = vp.mobile ? await page.context().newCDPSession(page) : null;
  const x = vp.width * 0.5;
  const y = vp.height * 0.3;
  let shot = null;
  let attachedAtShot = false;
  for (let round = 0; round < 5; round++) {
    const last = round === 4;
    if (vp.mobile && last) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await sleep(700);
      shot = await page.screenshot(); // mid-swing
      attachedAtShot = await hook(page, 't.attached');
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else if (vp.mobile) {
      await touchHold(page, client, x + (round % 2 ? 60 : -60), y, 1100);
    } else {
      await page.mouse.move(x + (round % 2 ? 220 : -220), y);
      await page.keyboard.down('KeyW');
      await page.mouse.down();
      await sleep(last ? 700 : 1100);
      if (last) {
        shot = await page.screenshot();
        attachedAtShot = await hook(page, 't.attached');
      }
      await page.mouse.up();
      await page.keyboard.up('KeyW');
    }
    await sleep(500);
  }
  // drop to a surface, then run on foot (W + Shift) and turn
  // drop to a surface; flying into a facade makes the hero cling (wall-run), so kick off walls
  for (let t = 0; t < 30000 && !(await hook(page, 't.freeGrounded()')); t += 300) {
    if (await hook(page, 't.freeWall()')) await page.keyboard.press('Space');
    await sleep(300);
  }
  await waitFor(page, 't.freeGrounded()', 1000, 'free swing landing');
  const groundStart = await hook(page, 't.free.groundDistance');
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await sleep(1400);
  const runShot = await page.screenshot();
  await page.keyboard.down('KeyD');
  await sleep(600);
  await page.keyboard.up('KeyD');
  // running off a roof edge is legitimate: keep sprinting (up to 8 s) until real distance is covered on foot
  for (let t = 0; t < 8000; t += 250) {
    if ((await hook(page, 't.free.groundDistance')) - groundStart > 12) break;
    await sleep(250);
  }
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');
  const stats = await hook(page, 't.free');
  const ran = stats.groundDistance - groundStart;
  return { ...stats, traveled: stats.distance - start, ran, shot, runShot, attachedAtShot };
}

async function run(browser, vp, reduced) {
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.mobile ? 2 : 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const dir = reduced ? join(OUT, 'reduced') : OUT;
  await mkdir(dir, { recursive: true });
  const tag = `${vp.name}${reduced ? '-reduced' : ''}`;
  const shots = [];
  const extras = [];

  await page.goto(`${server.origin}/${vp.query}`);
  await waitFor(page, 't && t.ready', 30000, 'app ready');
  const info = await hook(page, '({ webgl: t.webgl, quality: t.quality })');
  const gl = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('webgl2');
    const ext = c && c.getExtension('WEBGL_debug_renderer_info');
    return ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a';
  });
  await sleep(1500);
  const scrolled = await scrollThrough(page, vp);

  for (const shotDef of SHOTS) {
    const s = shotDef.p === 'trick' ? { ...shotDef, p: (await hook(page, 't.trickMoments()'))[0] ?? 0.4 } : shotDef;
    await hook(page, `t.goto(${s.chapter}, ${s.pre ?? s.p})`);
    await waitFor(page, `t.chapter === ${s.chapter}`, 5000, `chapter ${s.chapter}`);
    await sleep(reduced ? 1400 : 1800);
    if (s.pre !== undefined) {
      // step across the impact beat so the comic SFX word is on screen
      await hook(page, `t.goto(${s.chapter}, ${s.p})`);
      await sleep(420);
    }
    const file = join(dir, `${vp.name}-${s.file}.png`);
    await page.screenshot({ path: file });
    (s.extra ? extras : shots).push(file);
  }

  // chapter 5: let the rescue auto-complete with no input
  await page.keyboard.press('5');
  await waitFor(page, 't.chapter === 4', 8000, 'rescue chapter');
  const savedIn = await waitFor(page, "t.rescue === 'saved' && document.documentElement.dataset.rescue === 'saved'", 90000, 'train saved');
  const rescue = await hook(page, 't.rescueState');
  await sleep(3800);
  const f5 = join(dir, `${vp.name}-5-rescue-saved.png`);
  await page.screenshot({ path: f5 });
  shots.push(f5);

  const free = await freeSwing(page, vp);
  const f6 = join(dir, `${vp.name}-6-free-swing.png`);
  await writeFile(f6, free.shot);
  delete free.shot;
  shots.push(f6);
  const f6b = join(dir, `${vp.name}-6b-free-run.png`);
  await writeFile(f6b, free.runShot);
  delete free.runShot;
  extras.push(f6b);
  const freeOk = free.fired > 0 && free.released > 0 && free.traveled > 30 && free.ran > 8;

  await context.close();
  return { tag, info, gl, scrolled, errors, shots, extras, savedIn, rescue, free, freeOk };
}

const server = await serveDist();
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-angle=default'] });
const results = [];
try {
  for (const reduced of [false, true]) {
    for (const vp of VIEWPORTS) {
      process.stdout.write(`▶ ${vp.name} ${vp.width}x${vp.height}${reduced ? ' (prefers-reduced-motion)' : ''} … `);
      const r = await run(browser, vp, reduced);
      results.push(r);
      console.log(`done: ${r.errors.length} errors, saved in ${(r.savedIn / 1000).toFixed(1)}s`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}

let ok = true;
console.log('\n================ THREADLINE VERIFY REPORT ================');
for (const r of results) {
  const pass = r.errors.length === 0 && r.rescue?.saved && r.freeOk && r.info.webgl;
  ok &&= pass;
  console.log(`\n[${pass ? 'PASS' : 'FAIL'}] ${r.tag}`);
  console.log(`  webgl=${r.info.webgl} tier=${r.info.quality} renderer="${r.gl}"`);
  console.log(`  scroll-through reached chapters: ${r.scrolled.map((c) => c + 1).join(', ')}`);
  console.log(`  console/page errors: ${r.errors.length}`);
  r.errors.forEach((e) => console.log(`    - ${e}`));
  console.log(`  train saved: ${r.rescue?.saved} (nose x=${r.rescue?.x.toFixed(2)}, anchors ${r.rescue?.anchored}/4, auto-completed in ${(r.savedIn / 1000).toFixed(1)}s)`);
  console.log(`  free swing: fired=${r.free.fired} released=${r.free.released} misses=${r.free.misses} traveled=${r.free.traveled.toFixed(0)}m tetherAttachedInShot=${r.free.attachedAtShot} tricks=${r.free.tricks} ranOnFoot=${r.free.ran.toFixed(0)}m maxSpeed=${(r.free.maxSpeed * 3.6).toFixed(0)}km/h → ${r.freeOk ? 'WORKING' : 'BROKEN'}`);
  console.log('  screenshots:');
  r.shots.forEach((s) => console.log(`    ${s.replace(resolve('.') + '\\', '').replace(resolve('.') + '/', '')}`));
  console.log(`  extra review shots: ${r.extras.length}`);
}
const total = results.reduce((n, r) => n + r.errors.length, 0);
console.log(`\nTOTAL console/page errors: ${total}`);
console.log(ok ? 'VERIFY: ALL CHECKS PASSED' : 'VERIFY: FAILED');
await writeFile(resolve('verify/report.json'), JSON.stringify(results, null, 2));
process.exit(ok ? 0 : 1);
