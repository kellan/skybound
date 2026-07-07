import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './helpers/harness.js';

// The Noodle House rumor loop: ask ashore, the fog parts over the nearest
// undiscovered isle, once per island per voyage, persisted in the save.

test('rumors: asking parts the fog over the nearest unfound isle, once per island', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const source = g.state.islands[0];

    assert.equal(g.state.rumors.length, 0, 'fresh voyage has no rumors spent');
    const before = g.state.reveals.length;

    const first = T.askRumorAt(source);
    assert.equal(first.ok, true);
    assert.match(first.message, /isle to the [NESW]/);
    assert.ok(g.state.reveals.length > before, 'fog stamps were added');
    assert.deepEqual([...g.state.rumors], [T.rumorKey(source)], 'rumor spent at this island');

    // The new stamps sit on the rumored isle, not on the source island.
    const newest = g.state.reveals[g.state.reveals.length - 1];
    const nearSource = Math.hypot(newest.x - source.x, newest.y - source.y);
    assert.ok(nearSource > 100, 'reveal landed away from the asking island');
    const target = g.state.islands.find(i =>
      !i.discovered && i !== source && Math.hypot(i.x - newest.x, i.y - newest.y) < 200);
    assert.ok(target, 'reveal landed near an undiscovered island');

    const between = g.state.reveals.length;
    const second = T.askRumorAt(source);
    assert.equal(second.ok, false, 'no second rumor at the same island');
    assert.match(second.message, /No fresh gossip/);
    assert.equal(g.state.reveals.length, between, 'no extra stamps');
  } finally { h.close(); }
});

test('rumors: a fully charted layer has no rumors left to give', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    for (const i of g.state.islands) i.discovered = true;
    const res = g._test.askRumorAt(g.state.islands[0]);
    assert.equal(res.ok, false);
    assert.match(res.message, /already on your chart/);
    assert.equal(g.state.rumors.length, 0, 'nothing spent on a refusal');
  } finally { h.close(); }
});

test('rumors: spent rumors survive a save round-trip', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    T.askRumorAt(g.state.islands[0]);
    T.saveState();
    const saved = JSON.parse(h.window.localStorage.getItem(T.saveKey));
    assert.equal(saved.schemaVersion, 4);
    assert.deepEqual(saved.rumors, [...g.state.rumors]);

    // Boot a second game from that save: rumor stays spent.
    const h2 = await bootGame({ savedState: saved });
    try {
      const g2 = h2.game;
      assert.deepEqual([...g2.state.rumors], [...g.state.rumors]);
      const again = g2._test.askRumorAt(g2.state.islands[0]);
      assert.equal(again.ok, false, 'rumor still spent after reload');
    } finally { h2.close(); }
  } finally { h.close(); }
});

test('rumors: v3 saves migrate to v4 with an empty rumor ledger', async () => {
  const h = await bootGame();
  try {
    const T = h.game._test;
    T.saveState();
    const v3 = JSON.parse(h.window.localStorage.getItem(T.saveKey));
    delete v3.rumors;
    v3.schemaVersion = 3;

    const h2 = await bootGame({ savedState: v3 });
    try {
      assert.equal(h2.game.state.rumors.length, 0, 'migration adds the ledger');
      const res = h2.game._test.askRumorAt(h2.game.state.islands[0]);
      assert.equal(res.ok, true, 'rumors work on a migrated save');
    } finally { h2.close(); }
  } finally { h.close(); }
});
