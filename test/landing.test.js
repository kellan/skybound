import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './helpers/harness.js';

// The 3D village module itself needs WebGL, so these tests stub the loader
// via the setVillageLoader seam and cover the game-side wiring: Land button
// visibility, overlay lifecycle, deterministic seeding, and load failure.

function stubLoader(win, calls) {
  return () => Promise.resolve({
    createVillageView(opts) {
      calls.push({ type: 'create', seed: opts.seed, count: opts.count, root: opts.root, character: opts.character });
      return { dispose() { calls.push({ type: 'dispose' }); } };
    },
  });
}

test('landing: Land button shows only while docked', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const btn = h.document.getElementById('land-btn');
    const isle = g.state.islands[0];

    // Spawn point is near, but not on, the first island — adrift, no button.
    h.runFrames(3);
    assert.ok(!btn.classList.contains('show'), 'hidden while adrift');

    g._test.setShip(isle.x, isle.y);
    h.runFrames(3);
    assert.ok(btn.classList.contains('show'), 'shown while docked');

    // Charting a course hides it again.
    g._test.setTarget(isle.x + 500, isle.y, null);
    h.runFrames(3);
    assert.ok(!btn.classList.contains('show'), 'hidden once bound for elsewhere');

    g._test.clearTarget();
    h.runFrames(3);
    assert.ok(btn.classList.contains('show'), 'shown again when the course clears');
  } finally { h.close(); }
});

test('landing: overlay opens with a deterministic per-island village and closes clean', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const overlay = h.document.getElementById('village-overlay');
    const isle = g.state.islands[0];
    const calls = [];
    T.setVillageLoader(stubLoader(h.window, calls));

    await T.openVillage(isle);
    assert.ok(overlay.classList.contains('open'), 'overlay open');
    assert.equal(overlay.getAttribute('aria-hidden'), 'false');
    assert.equal(T.villageOpen, true);
    assert.equal(h.document.getElementById('village-name').textContent, isle.name);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].type, 'create');
    assert.equal(calls[0].seed, T.villageSeedFor(isle), 'seeded from the island');
    assert.equal(calls[0].count, T.villageBuildingCount(isle));
    assert.ok(calls[0].count >= 3 && calls[0].count <= 9, 'count within village range');
    // The island's identity travels with the landing.
    assert.deepEqual(calls[0].character.modifiers, isle.modifiers, 'modifiers passed through');
    assert.equal(calls[0].character.layer, g.state.layer, 'altitude layer passed through');

    // Opening twice is a no-op while ashore.
    await T.openVillage(isle);
    assert.equal(calls.length, 1, 'no second view while already ashore');

    T.closeVillage();
    assert.ok(!overlay.classList.contains('open'), 'overlay closed');
    assert.equal(overlay.getAttribute('aria-hidden'), 'true');
    assert.equal(calls[1].type, 'dispose', 'view disposed on leave');
    assert.equal(T.villageOpen, false);

    // Re-landing on the same island gets the same seed.
    await T.openVillage(isle);
    assert.equal(calls[2].seed, calls[0].seed, 'same island, same village');
    T.closeVillage();
  } finally { h.close(); }
});

test('landing: village seeds differ across islands', async () => {
  const h = await bootGame();
  try {
    const T = h.game._test;
    const [a, b] = h.game.state.islands;
    assert.equal(T.villageSeedFor(a), T.villageSeedFor(a), 'stable');
    assert.notEqual(T.villageSeedFor(a), T.villageSeedFor(b), 'distinct per island');
  } finally { h.close(); }
});

test('landing: a failed module load shows the fallback note and allows retry', async () => {
  const h = await bootGame();
  try {
    const T = h.game._test;
    const status = h.document.getElementById('village-status');
    const isle = h.game.state.islands[0];

    T.setVillageLoader(() => Promise.reject(new Error('no modules here')));
    await T.openVillage(isle);
    assert.equal(status.style.display, 'block', 'fallback note visible');
    assert.match(status.textContent, /3D view unavailable/);

    // Leaving and landing again with a working loader recovers.
    T.closeVillage();
    const calls = [];
    T.setVillageLoader(stubLoader(h.window, calls));
    await T.openVillage(isle);
    assert.equal(calls.length, 1, 'retry works after a failure');
    assert.equal(status.style.display, 'none', 'note cleared on success');
  } finally { h.close(); }
});
