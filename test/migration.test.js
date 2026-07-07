import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './helpers/harness.js';

const SAVE_KEY = 'skybound-poc-v3';
const LEGACY_KEY = 'skybound-poc-v2';

// A hand-built pre-altitude (v2) save: flat islands/reveals, no layers,
// no schemaVersion field. Shape matches what saveState wrote before a52b94c.
function v2Save() {
  return {
    seed: 12345,
    mapSize: 'small',
    islands: [
      { x: 1000, y: 900, radius: 40, name: 'Emberwatch', shape: 17, discovered: true },
      { x: 1600, y: 1400, radius: 32, name: 'Palegate', shape: 421, discovered: false },
      { x: 2400, y: 700, radius: 45, name: 'Duskspire', shape: 88, discovered: true },
    ],
    ship: { x: 1060, y: 960, vx: 0, vy: 0, heading: 0.5, facingLeft: false },
    shipType: 'sloop',
    target: { x: 1600, y: 1400, name: 'Palegate' },
    reveals: [{ x: 1060, y: 960 }, { x: 1300, y: 1100 }],
  };
}

test('migration: a legacy v2 save is upgraded to the layered format', async () => {
  const h = await bootGame({ savedState: v2Save(), savedStateKey: LEGACY_KEY });
  try {
    const g = h.game;
    const T = g._test;

    // The old flat world became the middle (spawn) layer.
    assert.equal(g.state.layer, T.constants.DEFAULT_LAYER, 'current layer is the default layer');
    assert.equal(g.state.layers.length, T.constants.LAYER_COUNT, 'all layers present');
    assert.equal(g.state.islands.length, 3, 'old islands carried over verbatim');
    assert.equal(g.state.islands[0].name, 'Emberwatch');
    assert.equal(g.state.islands[0].discovered, true, 'discovery flags preserved');
    assert.equal(g.state.islands[1].discovered, false);
    assert.ok(g.state.islands[0].modifiers, 'modifiers recomputed from names');

    // Ship, target, and reveals survived.
    assert.equal(g.state.ship.x, 1060);
    assert.equal(g.state.ship.heading, 0.5);
    assert.equal(g.state.shipType, 'sloop');
    assert.equal(g.state.target.name, 'Palegate');
    assert.equal(g.state.reveals.length, 2);

    // Other layers were generated fresh from the seed.
    for (let i = 0; i < g.state.layers.length; i++) {
      if (i === T.constants.DEFAULT_LAYER) continue;
      assert.ok(g.state.layers[i].islands.length > 0, `layer ${i} generated`);
    }

    // The migrated save was persisted under the new key; the old key is gone.
    const raw = h.window.localStorage.getItem(SAVE_KEY);
    assert.ok(raw, 'migrated save written under current key');
    const persisted = JSON.parse(raw);
    assert.equal(persisted.schemaVersion, T.constants.SAVE_SCHEMA, 'schemaVersion stamped');
    assert.deepEqual(persisted.rumors, [], 'v2→v4 chain adds the rumor ledger');
    assert.equal(persisted.layers[persisted.layer].islands[0].name, 'Emberwatch');
    assert.equal(h.window.localStorage.getItem(LEGACY_KEY), null, 'legacy key removed');
  } finally { h.close(); }
});

test('migration: pre-v6 saves keep their legacy world geometry', async () => {
  // Build a v5-era save (no world dims) from a real game, then check it
  // loads under the legacy small-map dims instead of the retuned ones.
  const h1 = await bootGame();
  let v5;
  try {
    h1.game._test.saveState();
    v5 = JSON.parse(h1.window.localStorage.getItem(SAVE_KEY));
    delete v5.world;
    v5.schemaVersion = 5;
  } finally { h1.close(); }

  const h2 = await bootGame({ savedState: v5 });
  try {
    const C = h2.game._test.constants;
    assert.equal(C.WORLD.w, 3600, 'legacy width preserved');
    assert.equal(C.WORLD.h, 2800, 'legacy height preserved');
    const persisted = JSON.parse(h2.window.localStorage.getItem(SAVE_KEY) || 'null');
    // The migrated save carries its dims forward from now on.
    assert.equal(h2.game.state.world.w, 3600);
  } finally { h2.close(); }
});

test('density: fresh voyages use the retuned sparser map', async () => {
  const h = await bootGame();
  try {
    const C = h.game._test.constants;
    assert.equal(C.WORLD.w, 4200, 'new world width');
    assert.equal(h.game.state.islands.length, 17, '17 isles per layer');
    assert.equal(C.MIN_ISLAND_DIST, 560, 'wider spacing floor');
    assert.equal(h.game.state.world.islandCount, 17, 'dims stamped into the save');
  } finally { h.close(); }
});

test('migration: a save from a newer schema falls back to a fresh game', async () => {
  const futureSave = { schemaVersion: 99, seed: 777, layers: [] };
  const h = await bootGame({ savedState: futureSave });
  try {
    const g = h.game;
    // The future save must not be loaded (or half-loaded) — fresh game instead.
    assert.notEqual(g.state.seed, 777, 'future save not loaded');
    assert.equal(g.state.islands.length, g._test.constants.ISLAND_COUNT, 'fresh world generated');
  } finally { h.close(); }
});

test('migration: current-schema saves load without a migration pass', async () => {
  // Round-trip through the real serializer, then confirm schemaVersion is
  // still current and nothing was mangled.
  const h1 = await bootGame();
  let saved;
  try {
    h1.game._test.saveState();
    saved = JSON.parse(h1.window.localStorage.getItem(SAVE_KEY));
    assert.equal(saved.schemaVersion, h1.game._test.constants.SAVE_SCHEMA);
  } finally { h1.close(); }

  const h2 = await bootGame({ savedState: saved });
  try {
    assert.equal(h2.game.state.seed, saved.seed);
    assert.equal(h2.game.state.layers.length, saved.layers.length);
  } finally { h2.close(); }
});
