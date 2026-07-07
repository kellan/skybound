// Real-browser smoke test for the landing flow — the part of the game the
// JSDOM suite can't see (WebGL, the three.js module graph, actual rendering).
// Boots the real index.html in headless Chromium, docks, lands, and asserts
// the village view exists and drew something. Run via `npm run test:browser`.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serveRepo, chromiumExecutablePath } from './helpers/server.js';

let server, browser, page;
const pageErrors = [];

before(async () => {
  server = await serveRepo();
  browser = await chromium.launch({
    executablePath: chromiumExecutablePath(),
    // Software GL so the test renders the same on CI runners without a GPU.
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  page = await browser.newPage({ viewport: { width: 414, height: 896 } });
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));
});

after(async () => {
  await browser?.close();
  await server?.close();
});

test('smoke: game boots, docking reveals the Land button', async () => {
  await page.goto(server.origin + '/index.html');
  await page.waitForFunction(() => !!window.__game, null, { timeout: 10_000 });
  await page.locator('#begin').dispatchEvent('click');

  // Spawn is near the first island but outside docking range.
  assert.equal(await page.locator('#land-btn.show').count(), 0, 'hidden while adrift');

  await page.evaluate(() => {
    const isle = window.__game.state.islands[0];
    window.__game._test.setShip(isle.x, isle.y);
  });
  await page.waitForSelector('#land-btn.show', { timeout: 5_000 });
});

test('smoke: landing renders the 3D village and Set Sail tears it down', async () => {
  await page.click('#land-btn');

  // The module graph loads and the view mounts a WebGL canvas.
  await page.waitForSelector('#village-stage canvas', { timeout: 20_000 });
  await page.waitForSelector('.vv-label', { timeout: 10_000 });

  const info = await page.evaluate(() => {
    const isle = window.__game.state.islands[0];
    return {
      bubbles: document.querySelectorAll('.vv-label').length,
      expected: window.__game._test.villageBuildingCount(isle),
      name: document.getElementById('village-name').textContent,
      isleName: isle.name,
      canvasW: document.querySelector('#village-stage canvas').width,
    };
  });
  assert.equal(info.bubbles, info.expected, 'one icon bubble per building');
  assert.equal(info.name, info.isleName, 'overlay names the island');
  assert.ok(info.canvasW > 0, 'canvas has a real backing buffer');

  // The scene actually drew: the renderer submitted real geometry last frame.
  // (Pixel readback is unreliable post-composite, so ask the renderer.)
  const drew = await page.evaluate(() => {
    const r = window.__game._test.villageView.renderer.info.render;
    return { calls: r.calls, triangles: r.triangles };
  });
  assert.ok(drew.calls > 0, 'render calls were made');
  assert.ok(drew.triangles > 10_000, `terrain-scale geometry drawn, got ${drew.triangles} tris`);

  await page.click('#village-leave');
  await page.waitForFunction(
    () => !document.querySelector('#village-overlay.open'), null, { timeout: 5_000 });
  assert.equal(await page.locator('#village-stage canvas').count(), 0, 'GL canvas disposed');
});

test('smoke: village-lab boots and renders', async () => {
  await page.goto(server.origin + '/village-lab.html');
  await page.waitForSelector('#stage canvas', { timeout: 20_000 });
  await page.waitForSelector('.vv-label', { timeout: 10_000 });
});

test('smoke: no page errors across the whole flow', () => {
  assert.deepEqual(pageErrors, []);
});
