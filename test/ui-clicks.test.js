// Tests that the wired UI click targets still do what they're supposed to.
// Each test dispatches a real DOM event through the listener that the game
// registered, not a direct internal call — so this catches regressions in
// the wiring layer (event types, selectors, propagation, debounce locks),
// not just the underlying logic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './helpers/harness.js';

function clickEl(window, el) {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

function tapCanvas(window, canvas, clientX, clientY) {
  // The game listens for `pointerdown`. JSDOM doesn't ship PointerEvent in
  // all versions; MouseEvent with the right type string is enough because
  // the listener only reads clientX/clientY.
  const ev = new window.MouseEvent('pointerdown', {
    bubbles: true, cancelable: true, clientX, clientY,
  });
  canvas.dispatchEvent(ev);
}

test('chart: clicking the Captain\'s Log badge toggles the chart overlay', async () => {
  const h = await bootGame();
  try {
    const { document, window } = h;
    const badge = document.getElementById('log-badge');
    const overlay = document.getElementById('map-overlay');
    assert.ok(badge && overlay);
    assert.equal(overlay.classList.contains('open'), false, 'chart starts closed');

    clickEl(window, badge);
    assert.equal(overlay.classList.contains('open'), true, 'chart opens on badge click');

    // The toggleMinimap function has a ~280ms debounce lock. Advance the
    // clock past it before the second click.
    h.tick(300);
    clickEl(window, overlay);
    assert.equal(overlay.classList.contains('open'), false, 'tapping the overlay closes the chart');
  } finally { h.close(); }
});

test('chart: minimap renders the ship marker when open', async () => {
  // The chart open path runs drawMinimap each frame; this is mostly a
  // smoke test that the render path doesn't throw with the chart open.
  const h = await bootGame();
  try {
    const badge = h.document.getElementById('log-badge');
    clickEl(h.window, badge);
    h.runFrames(5);
    // No exception thrown = pass. As a sanity assertion, frameCount advanced.
    assert.ok(h.game.frameCount > 0);
    assert.equal(h.document.getElementById('map-overlay').classList.contains('open'), true);
  } finally { h.close(); }
});

test('canvas tap: empty sky sets an unnamed target', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const W = T.constants.WORLD;
    // Park the ship at world center so screen↔world math is easy.
    T.setShip(W.cx, W.cy, 0, 0, 0);
    T.clearTarget();
    h.runFrames(1); // refreshes camera

    const canvas = h.document.getElementById('world');
    // Tap somewhere off-center on the canvas. Convert via the same math the
    // game uses: world = screen - viewport/2 + camera.
    const sx = T.viewW * 0.75, sy = T.viewH * 0.25;
    tapCanvas(h.window, canvas, sx, sy);

    assert.ok(g.state.target, 'target set');
    assert.equal(g.state.target.name, null, 'unnamed target for empty sky');

    const expectedX = sx - T.viewW / 2 + T.camera.x;
    const expectedY = sy - T.viewH / 2 + T.camera.y;
    assert.ok(Math.abs(g.state.target.x - expectedX) < 0.5,
      `target.x matches screenToWorld (got ${g.state.target.x}, expected ${expectedX})`);
    assert.ok(Math.abs(g.state.target.y - expectedY) < 0.5,
      `target.y matches screenToWorld (got ${g.state.target.y}, expected ${expectedY})`);
  } finally { h.close(); }
});

test('canvas tap: tapping a discovered island targets it by name', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;

    // Discover an island and place the ship near it so the island is on
    // screen when we tap.
    const island = g.state.islands[0];
    island.discovered = true;
    T.setShip(island.x - 100, island.y, 0, 0, 0);
    T.clearTarget();
    h.runFrames(1);

    // Convert the island's world coords to screen coords.
    const sx = island.x - T.camera.x + T.viewW / 2;
    const sy = island.y - T.camera.y + T.viewH / 2;

    const canvas = h.document.getElementById('world');
    tapCanvas(h.window, canvas, sx, sy);

    assert.ok(g.state.target, 'target set');
    assert.equal(g.state.target.name, island.name, 'target matches island name');
    assert.equal(g.state.target.x, island.x);
    assert.equal(g.state.target.y, island.y);
  } finally { h.close(); }
});

test('canvas tap: tapping an undiscovered island treats it as empty sky', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;

    const island = g.state.islands.find(i => !i.discovered);
    assert.ok(island);
    // Park ship far enough away that update() doesn't auto-discover the
    // island on the first frame (DISCOVERY_RADIUS = 140).
    const offset = T.constants.DISCOVERY_RADIUS + 60;
    T.setShip(island.x - offset, island.y, 0, 0, 0);
    T.clearTarget();
    h.runFrames(1);
    assert.equal(island.discovered, false, 'island still undiscovered when we tap');

    const sx = island.x - T.camera.x + T.viewW / 2;
    const sy = island.y - T.camera.y + T.viewH / 2;
    const canvas = h.document.getElementById('world');
    tapCanvas(h.window, canvas, sx, sy);

    assert.ok(g.state.target);
    assert.equal(g.state.target.name, null,
      'undiscovered island still hidden — tap falls through to world point');
  } finally { h.close(); }
});

test('rim chip: tapping a chip targets the off-screen island it represents', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const W = T.constants.WORLD;

    // Discover everything, park ship at world center so most islands are
    // off-screen, then run a render frame so drawEdgeLabels populates the
    // hit-test list.
    for (const i of g.state.islands) i.discovered = true;
    T.setShip(W.cx, W.cy, 0, 0, 0);
    T.clearTarget();
    h.runFrames(2);

    const hits = T.edgeLabelHits;
    assert.ok(hits.length > 0, `at least one rim chip rendered (got ${hits.length})`);

    const hit = hits[0];
    const cx = hit.x + hit.w / 2;
    const cy = hit.y + hit.h / 2;
    const canvas = h.document.getElementById('world');
    tapCanvas(h.window, canvas, cx, cy);

    assert.ok(g.state.target, 'target set from chip tap');
    assert.equal(g.state.target.name, hit.island.name,
      'chip tap targets the island the chip represents');
    assert.equal(g.state.target.x, hit.island.x);
    assert.equal(g.state.target.y, hit.island.y);
  } finally { h.close(); }
});

test('rim chip: chip hit-test wins over the world-space tap interpretation', async () => {
  // A rim chip sits on top of the canvas visually. If the world point
  // under the chip happens to be empty sky, we must still resolve to the
  // chip's island — not the world point.
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const W = T.constants.WORLD;

    for (const i of g.state.islands) i.discovered = true;
    T.setShip(W.cx, W.cy, 0, 0, 0);
    T.clearTarget();
    h.runFrames(2);

    const hit = T.edgeLabelHits[0];
    assert.ok(hit);
    const cx = hit.x + hit.w / 2;
    const cy = hit.y + hit.h / 2;
    // The world point under the chip:
    const worldX = cx - T.viewW / 2 + T.camera.x;
    const worldY = cy - T.viewH / 2 + T.camera.y;

    const canvas = h.document.getElementById('world');
    tapCanvas(h.window, canvas, cx, cy);

    // Target should be the island center, not the world point under the chip.
    assert.notEqual(g.state.target.x, worldX,
      'target is not the raw world point under the chip');
    assert.equal(g.state.target.name, hit.island.name);
  } finally { h.close(); }
});

test('intro: Set Sail button via click event dismisses the overlay', async () => {
  // We already test this in boot-physics, but go through MouseEvent here
  // to mirror real event flow and catch the iOS click-bug class.
  const h = await bootGame();
  try {
    const intro = h.document.getElementById('intro');
    const btn = h.document.getElementById('begin');
    assert.ok(!intro.classList.contains('gone'));
    clickEl(h.window, btn);
    assert.ok(intro.classList.contains('gone'));
  } finally { h.close(); }
});
