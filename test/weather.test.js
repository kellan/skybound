import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './helpers/harness.js';

// Air streams: deterministic per (seed, layer), push the ship along their
// tangent — following winds speed a voyage, opposing winds slow it.

test('weather: streams are deterministic per layer and shaped per altitude', async () => {
  const h = await bootGame();
  try {
    const T = h.game._test;
    const first = T.windStreamsForCurrentLayer().map(s => ({ n: s.pts.length, w: s.halfWidth, str: s.strength }));
    const again = T.windStreamsForCurrentLayer().map(s => ({ n: s.pts.length, w: s.halfWidth, str: s.strength }));
    assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(again)));
    assert.equal(first.length, 3, 'Cloud Sea runs three trades');

    // The wind field agrees with itself.
    const s0 = T.windStreamsForCurrentLayer()[0];
    const mid = s0.pts[Math.floor(s0.pts.length / 2)];
    const w1 = T.windAt(mid.x, mid.y);
    const w2 = T.windAt(mid.x, mid.y);
    assert.ok(w1 && Math.hypot(w1.x, w1.y) > 10, 'strong wind at a stream core');
    assert.deepEqual(JSON.parse(JSON.stringify(w1)), JSON.parse(JSON.stringify(w2)));
  } finally { h.close(); }
});

test('weather: a following wind beats an opposing one over the same course', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;

    // Pick a stream point + its tangent, then sail with and against it.
    const stream = T.windStreamsForCurrentLayer()[0];
    const i = Math.floor(stream.pts.length / 2);
    const p = stream.pts[i];
    const q = stream.pts[i + 1];
    const tl = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const tx = (q.x - p.x) / tl, ty = (q.y - p.y) / tl;

    const sail = (dirX, dirY) => {
      T.setShip(p.x, p.y, 0, 0, Math.atan2(dirY, dirX));
      T.setTarget(p.x + dirX * 3000, p.y + dirY * 3000, null);
      for (let f = 0; f < 400; f++) T.update(1 / 60);
      const d = Math.hypot(g.state.ship.x - p.x, g.state.ship.y - p.y);
      T.clearTarget();
      return d;
    };

    const withWind = sail(tx, ty);
    const against = sail(-tx, -ty);
    assert.ok(withWind > against * 1.25,
      `following (${Math.round(withWind)}px) should clearly beat opposing (${Math.round(against)}px)`);
  } finally { h.close(); }
});

test('weather: calm ships stay put — no wind-creep while docked', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    // Park (no target, no speed) in the middle of a stream.
    const stream = T.windStreamsForCurrentLayer()[0];
    const p = stream.pts[Math.floor(stream.pts.length / 2)];
    T.setShip(p.x, p.y, 0, 0, 0);
    for (let f = 0; f < 120; f++) T.update(1 / 60);
    const drift = Math.hypot(g.state.ship.x - p.x, g.state.ship.y - p.y);
    assert.ok(drift < 1, `parked ship drifted ${drift.toFixed(1)}px`);
  } finally { h.close(); }
});
