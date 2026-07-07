// Boot index.html into JSDOM with a canvas shim and a deterministic clock.
// Exposes the running `window.__game` (including its `_test` internals) plus
// a `tick(dt_ms)` helper that drives the requestAnimationFrame queue.

import { JSDOM, VirtualConsole, requestInterceptor } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installCanvasShim } from './canvas-shim.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// Serve <script src> requests (ships.js) from the repo root so the page's
// external scripts execute in JSDOM just like inline ones.
const localFileInterceptor = requestInterceptor((request) => {
  const u = new URL(request.url);
  if (u.hostname === 'localhost') {
    const body = fs.readFileSync(path.join(ROOT, u.pathname), 'utf8');
    return new Response(body, {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
});

/**
 * @param {object} [opts]
 * @param {object|null} [opts.savedState] - pre-seeded localStorage state.
 * @param {{w:number,h:number}} [opts.viewport]
 * @param {boolean} [opts.silenceConsole] - swallow page console output.
 */
export async function bootGame(opts = {}) {
  const { savedState = null, viewport = { w: 414, h: 896 }, silenceConsole = true } = opts;
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  const virtualConsole = new VirtualConsole();
  if (!silenceConsole) virtualConsole.sendTo(console);

  // Deterministic clock + RAF queue. We install them in `beforeParse` so the
  // game's IIFE picks them up when boot() runs.
  let nowMs = 0;
  let rafQueue = [];
  let rafSeq = 0;

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/',
    resources: { interceptors: [localFileInterceptor] },
    virtualConsole,
    beforeParse(window) {
      installCanvasShim(window);

      if (savedState) {
        window.localStorage.setItem('skybound-poc-v3', JSON.stringify(savedState));
      }

      // Viewport
      Object.defineProperty(window, 'innerWidth', { value: viewport.w, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: viewport.h, configurable: true });
      window.devicePixelRatio = 1;

      // Deterministic clock
      window.performance.now = () => nowMs;
      window.Date.now = () => nowMs;

      // Deterministic RAF
      window.requestAnimationFrame = (cb) => {
        rafQueue.push(cb);
        return ++rafSeq;
      };
      window.cancelAnimationFrame = () => {};
    },
  });

  // Wait for parse + scripts to finish. The external ships.js loads through
  // LocalResourceLoader before the game's inline script runs, and 'load'
  // doesn't fire until both have executed — so boot() has run by then.
  await new Promise((resolve) => {
    if (dom.window.document.readyState === 'complete') resolve();
    else dom.window.addEventListener('load', () => resolve(), { once: true });
  });

  function tick(dtMs = 16.6667) {
    nowMs += dtMs;
    const q = rafQueue;
    rafQueue = [];
    for (const cb of q) {
      try { cb(nowMs); } catch (e) { /* surface in tests via __DBG, don't crash the tick */ }
    }
  }

  /** Run N frames. */
  function runFrames(n, dtMs = 16.6667) {
    for (let i = 0; i < n; i++) tick(dtMs);
  }

  /** Tick until predicate returns truthy or `maxFrames` exceeded. */
  function runUntil(predicate, maxFrames = 600, dtMs = 16.6667) {
    for (let i = 0; i < maxFrames; i++) {
      tick(dtMs);
      if (predicate()) return i + 1;
    }
    return -1;
  }

  function close() {
    dom.window.close();
  }

  return {
    dom,
    window: dom.window,
    document: dom.window.document,
    get game() { return dom.window.__game; },
    tick,
    runFrames,
    runUntil,
    close,
    get now() { return nowMs; },
  };
}
