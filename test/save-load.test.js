import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './helpers/harness.js';

const SAVE_KEY = 'skybound-poc-v2';

test('save/load: round-trip preserves seed, islands, ship, target, reveals', async () => {
  // Boot a fresh game, mutate state, save.
  const h1 = await bootGame();
  let saved;
  try {
    const g = h1.game;
    const T = g._test;
    const W = T.constants.WORLD;
    T.setShip(W.cx + 123, W.cy - 456, 0, 0, 1.2);
    T.setTarget(W.cx + 800, W.cy - 200, 'Test Atoll');
    g.state.islands[0].discovered = true;
    g.state.islands[5].discovered = true;
    g.state.reveals.length = 0;
    T.bakeFog();
    T.stampReveal(W.cx, W.cy);
    T.stampReveal(W.cx + 400, W.cy);
    T.stampReveal(W.cx + 800, W.cy);

    T.saveState();
    const raw = h1.window.localStorage.getItem(SAVE_KEY);
    assert.ok(raw, 'state written to localStorage');
    saved = JSON.parse(raw);
  } finally { h1.close(); }

  // Boot a second instance with that save and verify it loaded.
  const h2 = await bootGame({ savedState: saved });
  try {
    const g = h2.game;
    assert.equal(g.state.seed, saved.seed, 'seed restored');
    assert.equal(g.state.islands.length, saved.islands.length, 'island count restored');
    assert.equal(g.state.islands[0].discovered, true, 'discovery state restored (island 0)');
    assert.equal(g.state.islands[5].discovered, true, 'discovery state restored (island 5)');
    assert.equal(g.state.islands[1].discovered, false, 'undiscovered island stays undiscovered');

    assert.ok(Math.abs(g.state.ship.x - saved.ship.x) < 1e-6, 'ship.x restored');
    assert.ok(Math.abs(g.state.ship.y - saved.ship.y) < 1e-6, 'ship.y restored');
    assert.ok(Math.abs(g.state.ship.heading - saved.ship.heading) < 1e-6, 'heading restored');

    assert.ok(g.state.target, 'target restored');
    assert.equal(g.state.target.name, 'Test Atoll');

    assert.equal(g.state.reveals.length, saved.reveals.length, 'reveal count restored');

    // Most important: the dedup grid was rebuilt from the loaded reveals.
    const T = g._test;
    for (const r of saved.reveals) {
      assert.equal(T.hasNearbyStamp(r.x, r.y), true,
        `reveal at (${r.x},${r.y}) indexed in dedup grid after load`);
    }
  } finally { h2.close(); }
});

test('save/load: a fresh boot with no save creates a deterministic-shaped state', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    assert.ok(typeof g.state.seed === 'number');
    assert.equal(g.state.islands.length, g._test.constants.ISLAND_COUNT);
    for (const i of g.state.islands) {
      assert.ok(typeof i.x === 'number' && typeof i.y === 'number');
      assert.ok(typeof i.name === 'string' && i.name.length > 0);
    }
    assert.ok(g.state.reveals.length >= 1, 'starting reveal present');
  } finally { h.close(); }
});

test('save/load: corrupted localStorage falls back to a new game', async () => {
  // Inject garbage into the save slot before boot.
  const h = await bootGame({ savedState: null });
  try {
    h.window.localStorage.setItem(SAVE_KEY, '{not json');
    // Re-run loadOrCreateState by hand to test fallback.
    const fresh = h.game._test.loadOrCreateState();
    assert.ok(fresh && fresh.islands && fresh.islands.length > 0,
      'fallback produced a usable state');
  } finally { h.close(); }
});
