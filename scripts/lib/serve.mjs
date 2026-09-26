// Minimal static server for dist/ used by the Playwright scripts (verify, perf, gpubench, hero-shots).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

/**
 * Serve a directory on localhost.
 * @param {{root?: string, port?: number}} [opts] port 0 (default) picks a free port
 * @returns {Promise<{origin: string, close: () => Promise<void>}>}
 */
export async function serveDist({ root = 'dist', port = 0 } = {}) {
  const ROOT = resolve(root);
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = resolve(join(ROOT, path === '/' ? 'index.html' : path));
      if (file !== ROOT && !file.startsWith(ROOT + sep)) throw new Error('outside root');
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise((ok, fail) => server.once('error', fail).listen(port, '127.0.0.1', ok));
  return {
    origin: `http://localhost:${server.address().port}`,
    close: () => new Promise((ok) => server.close(() => ok())),
  };
}
