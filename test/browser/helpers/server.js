// Tiny static file server for the browser smoke tests. The landing village
// is an ES module graph, so file:// isn't enough — modules need http and
// correct MIME types. No dependencies; serves the repo root, read-only.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
};

/** Start serving the repo root on an ephemeral port; returns { origin, close }. */
export function serveRepo() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.normalize(path.join(ROOT, urlPath === '/' ? '/index.html' : urlPath));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

/**
 * Chromium executable for this environment: the Claude sandbox pre-installs
 * one at /opt/pw-browsers/chromium; CI installs Playwright's own build
 * (`npx playwright install chromium`), in which case we let Playwright
 * resolve it. Override with SKYBOUND_CHROMIUM if neither fits.
 */
export function chromiumExecutablePath() {
  if (process.env.SKYBOUND_CHROMIUM) return process.env.SKYBOUND_CHROMIUM;
  const preinstalled = '/opt/pw-browsers/chromium';
  if (fs.existsSync(preinstalled)) return preinstalled;
  return undefined;
}
