import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './helpers/harness.js';

test('altitude: fresh state has three layers and starts on the middle one', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const C = g._test.constants;
    assert.equal(C.LAYER_COUNT, 3);
    assert.equal(g.state.layer, C.DEFAULT_LAYER);
    assert.equal(g.state.layers.length, C.LAYER_COUNT);
    for (const layer of g.state.layers) {
      assert.equal(layer.islands.length, C.ISLAND_COUNT);
    }
    // The middle (spawn) layer's first island must be neutral (no modifiers).
    assert.equal(g.state.layers[C.DEFAULT_LAYER].islands[0].modifiers.length, 0);
    // Convenience refs point at the current layer.
    assert.strictEqual(g.state.islands, g.state.layers[g.state.layer].islands);
    assert.strictEqual(g.state.reveals, g.state.layers[g.state.layer].reveals);
  } finally { h.close(); }
});

test('altitude: ascend & descend transitions swap the active layer and rebind refs', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const dur = T.constants.TRANSITION_DUR;
    const startLayer = g.state.layer;

    const layer0Islands = g.state.layers[startLayer].islands;
    assert.ok(T.ascend(), 'ascend kicks off when not at top');
    assert.ok(g.state.transition, 'transition state set');

    // Drive frames until the transition completes (~2.5s).
    h.runFrames(Math.ceil(dur / 0.016) + 30, 16);
    assert.equal(g.state.transition, null, 'transition cleared');
    assert.equal(g.state.layer, startLayer - 1, 'now on the higher layer');
    assert.notStrictEqual(g.state.islands, layer0Islands, 'island ref rebound');
    assert.strictEqual(g.state.islands, g.state.layers[g.state.layer].islands);

    // Now descend back down.
    assert.ok(T.descend(), 'descend kicks off');
    h.runFrames(Math.ceil(dur / 0.016) + 30, 16);
    assert.equal(g.state.layer, startLayer, 'back on the starting layer');
  } finally { h.close(); }
});

test('altitude: ascend at top / descend at bottom is rejected', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const C = T.constants;
    const dur = C.TRANSITION_DUR;

    // Climb to top layer (index 0).
    while (g.state.layer > 0) {
      T.ascend();
      h.runFrames(Math.ceil(dur / 0.016) + 30, 16);
    }
    assert.equal(g.state.layer, 0);
    assert.equal(T.ascend(), false, 'cannot ascend past top');

    // Drop to bottom layer (index LAYER_COUNT-1).
    while (g.state.layer < C.LAYER_COUNT - 1) {
      T.descend();
      h.runFrames(Math.ceil(dur / 0.016) + 30, 16);
    }
    assert.equal(g.state.layer, C.LAYER_COUNT - 1);
    assert.equal(T.descend(), false, 'cannot descend past bottom');
  } finally { h.close(); }
});

test('altitude: target clears on transition; taps during transition are ignored', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const W = T.constants.WORLD;
    const dur = T.constants.TRANSITION_DUR;

    T.setTarget(W.cx + 200, W.cy + 200, 'Phantom');
    assert.ok(g.state.target, 'target set');
    T.descend();
    assert.equal(g.state.target, null, 'target dropped on transition start');

    // Mid-transition tap should be ignored.
    const beforeFrames = 5;
    h.runFrames(beforeFrames, 16);
    T.onTap(100, 100);
    assert.equal(g.state.target, null, 'tap during transition does not set target');

    h.runFrames(Math.ceil(dur / 0.016) + 30, 16);
    assert.equal(g.state.transition, null, 'transition cleared');
    // After transition, tap works again.
    T.onTap(100, 100);
    assert.ok(g.state.target, 'tap after transition sets target');
  } finally { h.close(); }
});

test('altitude: per-layer reveals are independent', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const W = T.constants.WORLD;
    const dur = T.constants.TRANSITION_DUR;

    const startLayer = g.state.layer;
    const startRevealCount = g.state.layers[startLayer].reveals.length;

    T.ascend();
    h.runFrames(Math.ceil(dur / 0.016) + 30, 16);
    const upLayer = g.state.layer;
    assert.notEqual(upLayer, startLayer);

    // The new layer got a fresh stamp at the ship's position on swap.
    assert.ok(g.state.reveals.length >= 1,
      'arriving on a new layer leaves a starting reveal');
    // The original layer's reveals weren't disturbed.
    assert.equal(g.state.layers[startLayer].reveals.length, startRevealCount,
      'original layer reveals untouched');
  } finally { h.close(); }
});
