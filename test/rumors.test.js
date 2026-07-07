import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './helpers/harness.js';

// The Noodle House rumor loop: ask ashore, an ✕ marks the nearest unfound
// isle on the map/chart and the fog parts over it. One rumor per island per
// voyage, persisted in the save; asking again repeats the same tale.

// Cross-realm-safe snapshot of a JSDOM-side value for deep comparison.
const snap = (v) => JSON.parse(JSON.stringify(v));

test('rumors: asking marks the nearest unfound isle, once per island', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const source = g.state.islands[0];

    assert.equal(g.state.rumors.length, 0, 'fresh voyage has no rumors spent');
    assert.equal(T.activeRumorMarkers().length, 0, 'no markers yet');
    const before = g.state.reveals.length;

    const first = T.askRumorAt(source);
    assert.equal(first.ok, true);
    assert.match(first.message, /isle to the [NESW]/);
    assert.ok(g.state.reveals.length > before, 'fog stamps were added');

    const entry = snap(g.state.rumors[0]);
    assert.equal(g.state.rumors.length, 1);
    assert.equal(entry.at, T.rumorKey(source), 'spent at this island');
    assert.equal(entry.layer, g.state.layer);
    const target = g.state.islands.find(i =>
      !i.discovered && i !== source && Math.hypot(i.x - entry.x, i.y - entry.y) < 5);
    assert.ok(target, 'marker sits on an undiscovered island');
    assert.ok(entry.dist > 0 && /^[NESW]{1,2}$/.test(entry.dir), 'direction and distance recorded');

    // The marker shows on the current layer until that isle is found.
    assert.equal(T.activeRumorMarkers().length, 1, 'one active marker');

    // Asking again repeats the same tale, spends nothing, reveals nothing.
    const between = g.state.reveals.length;
    const second = T.askRumorAt(source);
    assert.equal(second.ok, false);
    assert.ok(second.message.includes(`the ${entry.dir}`), 'repeat keeps the direction');
    assert.ok(second.message.includes(`${entry.dist} lg`), 'repeat keeps the distance');
    assert.equal(g.state.rumors.length, 1, 'nothing new spent');
    assert.equal(g.state.reveals.length, between, 'no extra stamps');

    // Finding the isle retires the marker (the rumor stays spent).
    target.discovered = true;
    assert.equal(T.activeRumorMarkers().length, 0, 'marker gone once discovered');
    assert.equal(g.state.rumors.length, 1, 'ledger unchanged');
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

test('rumors: spent rumors survive a save round-trip with the same tale', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    T.askRumorAt(g.state.islands[0]);
    T.saveState();
    const saved = JSON.parse(h.window.localStorage.getItem(T.saveKey));
    assert.equal(saved.schemaVersion, T.constants.SAVE_SCHEMA);
    assert.deepEqual(saved.rumors, snap(g.state.rumors));

    // Boot a second game from that save: rumor stays spent, tale unchanged,
    // marker still active.
    const h2 = await bootGame({ savedState: saved });
    try {
      const g2 = h2.game;
      assert.deepEqual(snap(g2.state.rumors), snap(g.state.rumors));
      assert.equal(g2._test.activeRumorMarkers().length, 1, 'marker survives reload');
      const again = g2._test.askRumorAt(g2.state.islands[0]);
      assert.equal(again.ok, false, 'rumor still spent after reload');
      assert.ok(again.message.includes(`${saved.rumors[0].dist} lg`), 'same tale after reload');
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

test('rumors: legacy string entries from early v4 builds are dropped on load', async () => {
  const h = await bootGame();
  try {
    const T = h.game._test;
    T.saveState();
    const saved = JSON.parse(h.window.localStorage.getItem(T.saveKey));
    saved.rumors = ['1:100,200']; // pre-object shape

    const h2 = await bootGame({ savedState: saved });
    try {
      assert.equal(h2.game.state.rumors.length, 0, 'string entries filtered out');
      const res = h2.game._test.askRumorAt(h2.game.state.islands[0]);
      assert.equal(res.ok, true, 'that island can be asked again');
    } finally { h2.close(); }
  } finally { h.close(); }
});
