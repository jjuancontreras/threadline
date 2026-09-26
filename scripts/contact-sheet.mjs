// Dev helper: tile a set of screenshots into one PNG for quick visual review.
// usage: node scripts/contact-sheet.mjs <dir> <prefix> <out.png> [width]
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [dir, prefix, out, w = '260'] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.png')).sort();
const figs = files
  .map((f) => `<figure><img src="data:image/png;base64,${readFileSync(join(dir, f)).toString('base64')}"><figcaption>${f}</figcaption></figure>`)
  .join('');
const html = `<body style="margin:0;background:#222;display:flex;flex-wrap:wrap;gap:6px;color:#fff;font:12px sans-serif">${figs}<style>figure{margin:0;width:${w}px}img{width:${w}px}</style></body>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Math.min(files.length, 6) * (Number(w) + 6), height: 400 } });
await page.setContent(html);
await page.screenshot({ path: resolve(out), fullPage: true });
await browser.close();
console.log(resolve(out));
