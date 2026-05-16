import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootGame } from './helpers/harness.js';

test('boot: HUD and canvas exist, game is exposed, islands generated', async () => {
  const h = await bootGame();
  try {
    const doc = h.document;
    assert.ok(doc.getElementById('world'), 'canvas#world present');
    assert.ok(doc.getElementById('top-bar'), 'top HUD present');
    assert.ok(doc.getElementById('bottom-bar'), 'bottom HUD present');
    assert.ok(doc.getElementById('compass'), 'compass present');
    assert.ok(doc.getElementById('begin'), 'Set Sail button present');
    assert.ok(doc.getElementById('intro'), 'intro overlay present');

    const g = h.game;
    assert.ok(g, '__game exposed');
    assert.equal(g.state.islands.length, g._test.constants.ISLAND_COUNT);
    assert.ok(g.state.ship);
    assert.ok(g.state.reveals.length >= 1, 'initial reveal stamp seeded');
  } finally { h.close(); }
});

test('boot: Set Sail click dismisses the intro overlay', async () => {
  const h = await bootGame();
  try {
    const intro = h.document.getElementById('intro');
    const btn = h.document.getElementById('begin');
    assert.ok(!intro.classList.contains('gone'), 'intro starts visible');
    btn.click();
    assert.ok(intro.classList.contains('gone'), 'intro dismissed after click');
  } finally { h.close(); }
});

test('boot: frame loop advances frameCount when ticked', async () => {
  const h = await bootGame();
  try {
    const start = h.game.frameCount;
    h.runFrames(30);
    assert.ok(h.game.frameCount - start >= 30, `frameCount advanced (was ${start}, now ${h.game.frameCount})`);
  } finally { h.close(); }
});

test('physics: ship reaches a straight-ahead target without overshooting', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    // Place ship at world center, facing +x, target straight ahead.
    const W = T.constants.WORLD;
    T.setShip(W.cx, W.cy, 0, 0, 0);
    const targetX = W.cx + 600, targetY = W.cy;
    T.setTarget(targetX, targetY);
    g.state.reveals.length = 0;
    T.bakeFog();

    // The game clears state.target on arrival, so capture coords first and
    // accept either the in-flight stop condition or the cleared-target signal.
    const arrived = h.runUntil(() => {
      const s = g.state.ship;
      if (!g.state.target) return true;
      const dist = Math.hypot(targetX - s.x, targetY - s.y);
      const speed = Math.hypot(s.vx, s.vy);
      return dist < 12 && speed < 8;
    }, 30 * 60);

    assert.ok(arrived > 0, 'ship arrived at target');
    // Hard ceiling — shouldn't sail past target by more than its braking margin.
    const s = g.state.ship;
    const overshoot = s.x - targetX;
    assert.ok(overshoot < 40, `no large overshoot (was ${overshoot.toFixed(1)}px past target)`);
  } finally { h.close(); }
});

test('physics: 180° reversal arrives without orbiting', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const W = T.constants.WORLD;
    // Ship moving right at high speed; target is behind it.
    T.setShip(W.cx, W.cy, T.constants.SHIP_MAX_SPEED, 0, 0);
    const targetX = W.cx - 600, targetY = W.cy;
    T.setTarget(targetX, targetY);

    let maxLateral = 0;
    const arrived = h.runUntil(() => {
      const s = g.state.ship;
      const dy = Math.abs(s.y - W.cy);
      if (dy > maxLateral) maxLateral = dy;
      if (!g.state.target) return true;
      const dist = Math.hypot(targetX - s.x, targetY - s.y);
      const speed = Math.hypot(s.vx, s.vy);
      return dist < 12 && speed < 8;
    }, 40 * 60);

    assert.ok(arrived > 0, 'ship arrived after reversal');
    // Lateral drift should stay bounded — if the ship were orbiting we'd see
    // it swing well off the y-axis.
    assert.ok(maxLateral < 200, `lateral drift bounded (peaked at ${maxLateral.toFixed(1)}px)`);
  } finally { h.close(); }
});

test('discovery: ship sailing into an island flips its discovered flag', async () => {
  const h = await bootGame();
  try {
    const g = h.game;
    const T = g._test;
    const target = g.state.islands.find(i => !i.discovered);
    assert.ok(target, 'at least one undiscovered island');
    // Drop ship right next to it so we don't need a long voyage.
    T.setShip(target.x - 60, target.y, 0, 0, 0);
    T.setTarget(target.x, target.y, target.name);
    h.runUntil(() => target.discovered, 10 * 60);
    assert.ok(target.discovered, 'island marked discovered');
  } finally { h.close(); }
});
