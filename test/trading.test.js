import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './helpers/harness.js';

// Barter trading: every island produces a good (layer staple or modifier
// rarity) and wants a staple from another altitude; deliveries pay in
// chart knowledge, once per island per voyage. Plus the skywright's
// stable: mounts vary by isle and altitude, and all must be findable.

const snap = (v) => JSON.parse(JSON.stringify(v));

function switchLayer(g, layerIndex) {
  g.state.layer = layerIndex;
  g.state.islands = g.state.layers[layerIndex].islands;
  g.state.reveals = g.state.layers[layerIndex].reveals;
}

test('trading: goods are deterministic, wants always cross altitudes', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const C = T.constants;
    for (let layer = 0; layer < C.LAYER_COUNT; layer++) {
      switchLayer(g, layer);
      for (const isle of g.state.islands.slice(0, 5)) {
        const goods = T.islandGoods(isle);
        assert.equal(snap(goods).produce, snap(T.islandGoods(isle)).produce, 'stable per island');
        assert.notEqual(goods.want, ['glacier ice', 'skywheat', 'salt fish'][layer],
          'want comes from a different layer than this one');
      }
    }
    // Modifier goods override the staple.
    switchLayer(g, 1);
    const glenIsle = g.state.islands[2];
    glenIsle.modifiers = ['glen'];
    assert.equal(T.islandGoods(glenIsle).produce, 'iron ore');
  } finally { h.close(); }
});

test('trading: take, carry, deliver — reward is a chart marker, once per isle', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const source = g.state.islands[0];

    // Take on the local produce.
    const take = T.takeGoodAt(source);
    assert.equal(take.ok, true);
    const { produce } = snap(T.islandGoods(source));
    assert.deepEqual(snap(g.state.hold), [produce]);
    assert.equal(T.takeGoodAt(source).ok, false, 'no duplicate cargo');

    // Find an island that wants what we carry (staple wants are per-layer
    // staples, so stock the hold with all three to be sure).
    g.state.hold = ['glacier ice', 'skywheat', 'salt fish'];
    const target = g.state.islands[1];
    const want = T.islandGoods(target).want;
    const markersBefore = g.state.rumors.length;

    const res = T.deliverGoodAt(target);
    assert.equal(res.ok, true);
    assert.match(res.message, /mark .* on your chart|village turns out/);
    assert.ok(!g.state.hold.includes(want), 'delivered good left the hold');
    assert.equal(snap(g.state.delivered)[0], T.rumorKey(target));
    assert.equal(g.state.rumors.length, markersBefore + 1, 'thanks = a chart marker');

    const again = T.deliverGoodAt(target);
    assert.equal(again.ok, false, 'storeroom full — once per isle per voyage');

    // An isle whose want we don't carry politely says what it needs.
    g.state.hold = [];
    const refusal = T.deliverGoodAt(g.state.islands[2]);
    assert.equal(refusal.ok, false);
    assert.match(refusal.message, /hoping for/);
  } finally { h.close(); }
});

test('stable: availability is deterministic, home layers favored, all mounts findable', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const C = T.constants;
    const allIds = T.SHIPS.map(s => s.id);

    // Deterministic per island.
    const first = snap(T.shipsAvailableAt(g.state.islands[0]));
    assert.deepEqual(snap(T.shipsAvailableAt(g.state.islands[0])), first);
    assert.ok(first.includes(g.state.shipType), 'your own mount is always stabled');

    // Sweep every island on every layer: union must cover the catalog, and
    // each mount must appear somewhere on its home layer.
    const seen = new Set();
    const seenOnHome = new Set();
    for (let layer = 0; layer < C.LAYER_COUNT; layer++) {
      switchLayer(g, layer);
      for (const isle of g.state.islands) {
        for (const id of T.shipsAvailableAt(isle)) {
          seen.add(id);
          if ((T.SHIP_HOME_LAYER[id] ?? 1) === layer) seenOnHome.add(id);
        }
      }
    }
    assert.deepEqual([...seen].sort(), [...allIds].sort(), 'every mount findable this voyage');
    assert.deepEqual([...seenOnHome].sort(), [...allIds].sort(), 'each on its home layer');

    // Not every mount everywhere: some island must be missing some mount.
    switchLayer(g, 1);
    const sparse = g.state.islands.some(i => T.shipsAvailableAt(i).length < allIds.length);
    assert.ok(sparse, 'availability actually varies');
  } finally { h.close(); }
});

test('stable: visiting the skywright records mounts seen; ledger survives saves', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const isle = g.state.islands[0];
    assert.deepEqual(snap(g.state.mountsSeen), [g.state.shipType], 'you know your own mount');

    T.openHangar(isle);
    const expected = new Set([g.state.shipType, ...T.shipsAvailableAt(isle)]);
    assert.deepEqual(new Set(snap(g.state.mountsSeen)), expected, 'stable teaches its mounts');
    T.closeHangar();

    T.saveState();
    const saved = JSON.parse(h.window.localStorage.getItem(T.saveKey));
    assert.equal(saved.schemaVersion, T.constants.SAVE_SCHEMA);
    assert.deepEqual(saved.mountsSeen, snap(g.state.mountsSeen));

    // v4 saves (rumors era) gain the trading fields on load.
    const v4 = { ...saved };
    delete v4.hold; delete v4.delivered; delete v4.mountsSeen;
    v4.schemaVersion = 4;
    const h2 = await bootGame({ savedState: v4 });
    try {
      assert.deepEqual(snap(h2.game.state.hold), []);
      assert.deepEqual(snap(h2.game.state.delivered), []);
      assert.deepEqual(snap(h2.game.state.mountsSeen), [h2.game.state.shipType]);
    } finally { h2.close(); }
  } finally { h.close(); }
});

test('log badge counts discoveries across all three altitudes', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    h.runFrames(3);
    const el = h.document.getElementById('discovered-count');
    const total = g.state.layers.reduce((n, l) => n + l.islands.length, 0);
    assert.match(el.textContent, new RegExp(`/ ${total} isles`), 'denominator spans layers');
    const before = parseInt(el.textContent, 10);

    // Discover an island on a DIFFERENT layer; the count must include it.
    g.state.layers[0].islands[0].discovered = true;
    h.runFrames(2);
    assert.equal(parseInt(el.textContent, 10), before + 1);
  } finally { h.close(); }
});
