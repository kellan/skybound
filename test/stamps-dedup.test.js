import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './helpers/harness.js';

test('dedup: a second stamp inside DEDUP_RADIUS is rejected', async () => {
  const h = await bootGame();
  try {
    const T = h.game._test;
    h.game.state.reveals.length = 0;
    T.bakeFog();
    const D = T.constants.DEDUP_RADIUS;

    assert.equal(T.stampReveal(1000, 1000), true, 'first stamp accepted');
    assert.equal(T.stampReveal(1000 + D * 0.3, 1000), false, 'nearby stamp rejected');
    assert.equal(T.stampReveal(1000 + D * 1.05, 1000), true, 'stamp just outside radius accepted');
    assert.equal(h.game.state.reveals.length, 2);
  } finally { h.close(); }
});

test('dedup: hasNearbyStamp respects DEDUP_RADIUS', async () => {
  const h = await bootGame();
  try {
    const T = h.game._test;
    h.game.state.reveals.length = 0;
    T.bakeFog();
    const D = T.constants.DEDUP_RADIUS;

    T.stampReveal(500, 500);
    assert.equal(T.hasNearbyStamp(500, 500), true);
    assert.equal(T.hasNearbyStamp(500 + D * 0.99, 500), true);
    assert.equal(T.hasNearbyStamp(500 + D * 1.01, 500), false);
    assert.equal(T.hasNearbyStamp(500, 500 + D * 0.99), true);
  } finally { h.close(); }
});

test('dedup: bakeFog rebuilds the spatial grid from state.reveals', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;

    // Replace reveals with a known set, then rebake. The grid should reflect
    // exactly those entries — no leftovers from the prior session.
    g.state.reveals.length = 0;
    g.state.reveals.push({ x: 100, y: 100 }, { x: 2000, y: 2000 }, { x: 1500, y: 800 });
    T.bakeFog();

    assert.equal(T.hasNearbyStamp(100, 100), true);
    assert.equal(T.hasNearbyStamp(2000, 2000), true);
    assert.equal(T.hasNearbyStamp(1500, 800), true);
    // A point far from all known stamps is not nearby.
    assert.equal(T.hasNearbyStamp(3000, 100), false);

    // Grid bucket count = at most reveals.length (often fewer if neighbors collide).
    let total = 0;
    for (const arr of T.stampGrid.values()) total += arr.length / 2;
    assert.equal(total, 3, 'grid contains exactly the 3 stamps');
  } finally { h.close(); }
});

test('dedup: sailing back and forth on the same corridor stops growing stamps', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const W = T.constants.WORLD;

    // Clear and seed a single starting stamp.
    g.state.reveals.length = 0;
    T.setShip(W.cx, W.cy, 0, 0, 0);
    T.bakeFog();

    // Helper: sail to a point, treating cleared-target as arrival.
    const sailTo = (tx, ty) => {
      T.setTarget(tx, ty);
      h.runUntil(() => {
        if (!g.state.target) return true;
        const s = g.state.ship;
        return Math.hypot(tx - s.x, ty - s.y) < 12 && Math.hypot(s.vx, s.vy) < 8;
      }, 30 * 60);
    };

    // First voyage: 600px east. Expect a row of stamps along the path.
    sailTo(W.cx + 600, W.cy);
    const afterFirst = g.state.reveals.length;
    assert.ok(afterFirst >= 3, `first voyage produced stamps (got ${afterFirst})`);

    // Return trip + several repeats over the same corridor. With dedup, the
    // count should plateau quickly rather than growing linearly.
    for (let lap = 0; lap < 4; lap++) {
      sailTo(W.cx, W.cy);
      sailTo(W.cx + 600, W.cy);
    }
    const afterLaps = g.state.reveals.length;

    // Bound: at most ~2x the first-voyage count even after 4 round-trips.
    // (Without dedup we'd expect roughly 9x.)
    assert.ok(afterLaps <= afterFirst * 2,
      `stamps stayed bounded: first=${afterFirst}, after 4 round-trips=${afterLaps}`);
  } finally { h.close(); }
});

test('dedup: lone path-aligned stamps are still accepted (no false positives)', async () => {
  const h = await bootGame();
  try {
    const T = h.game._test;
    h.game.state.reveals.length = 0;
    T.bakeFog();
    const D = T.constants.DEDUP_RADIUS;

    // Stamps at 2*DEDUP_RADIUS spacing should all be accepted.
    let accepted = 0;
    for (let i = 0; i < 10; i++) {
      if (T.stampReveal(500 + i * D * 2, 500)) accepted++;
    }
    assert.equal(accepted, 10, 'all 10 well-spaced stamps accepted');
  } finally { h.close(); }
});
