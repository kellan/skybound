// Performance benchmarks for the scalability-sensitive paths.
//
// Caveats:
//   - The JSDOM canvas is a no-op shim, so drawing cost (gradients, fills,
//     drawImage) is excluded. Numbers reflect JS-side work only — the part
//     we care about for the scalability story (grid lookups, JSON encode,
//     state.reveals growth). Real per-stamp cost on iOS will be higher
//     because of the canvas radial-gradient fill.
//   - Numbers are sensitive to machine load. Thresholds are loose; tighten
//     once we have a baseline from CI.
//
// Run: npm run bench
// Exit code is nonzero if any threshold is exceeded.

import { bootGame } from './helpers/harness.js';
import { performance } from 'node:perf_hooks';

function fmt(ms) { return `${ms.toFixed(2)}ms`; }
function fmtUs(ns) { return `${(ns / 1000).toFixed(2)}µs`; }

let failures = 0;
function check(name, value, threshold, unit = 'ms') {
  const ok = value <= threshold;
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`  [${status}] ${name}: ${value.toFixed(2)}${unit} (threshold ${threshold}${unit})`);
  if (!ok) failures++;
}

function timed(fn) {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

// Pseudo-random walks across the world, for realistic stamp distributions.
function* walk(seed, count, world) {
  let s = seed >>> 0;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
  let x = world.cx, y = world.cy;
  for (let i = 0; i < count; i++) {
    x += (rng() - 0.5) * 200;
    y += (rng() - 0.5) * 200;
    // Keep inside the ellipse-ish bounds.
    if (x < 200) x = 200; else if (x > world.w - 200) x = world.w - 200;
    if (y < 200) y = 200; else if (y > world.h - 200) y = world.h - 200;
    yield { x, y };
  }
}

console.log('Skybound perf benchmarks');
console.log('========================\n');

const h = await bootGame();
const g = h.game;
const T = g._test;
const W = T.constants.WORLD;

// ---------------------------------------------------------------------------
// 1. Stamp insertion throughput at increasing world coverage.
// ---------------------------------------------------------------------------
console.log('1. stampReveal throughput (with dedup):');

for (const N of [1000, 10_000, 50_000]) {
  g.state.reveals.length = 0;
  T.bakeFog();
  const points = [...walk(42, N, W)];
  const elapsed = timed(() => {
    for (const p of points) T.stampReveal(p.x, p.y);
  });
  const accepted = g.state.reveals.length;
  const perCall = (elapsed / N) * 1000; // µs per attempt
  const dedupRate = ((1 - accepted / N) * 100).toFixed(1);
  console.log(`   N=${N.toString().padStart(6)}  total=${fmt(elapsed).padStart(9)}  per-call=${fmtUs(perCall * 1000).padStart(9)}  accepted=${accepted}  dedup=${dedupRate}%`);
  // Per-attempt should stay well under 50µs even at 50k.
  check(`     stampReveal per-call (N=${N})`, perCall, 50, 'µs');
}

// ---------------------------------------------------------------------------
// 2. bakeFog cost at varying reveal counts. This is what happens on boot
//    and on revealAll.
// ---------------------------------------------------------------------------
console.log('\n2. bakeFog rebuild cost:');

for (const N of [100, 1000, 10_000]) {
  g.state.reveals.length = 0;
  for (const p of walk(7, N, W)) g.state.reveals.push(p);
  const elapsed = timed(() => T.bakeFog());
  console.log(`   N=${N.toString().padStart(6)}  bake=${fmt(elapsed).padStart(9)}`);
  // 10k stamps should bake well under 500ms on a developer machine.
  check(`     bakeFog (N=${N})`, elapsed, N <= 1000 ? 50 : 500);
}

// ---------------------------------------------------------------------------
// 3. Frame-loop overhead with a long voyage's worth of stamps already laid.
//    Measures update + render path under load (canvas shim no-ops the actual
//    drawing — see caveats above).
// ---------------------------------------------------------------------------
console.log('\n3. Frame loop with 10k stamps already laid:');
{
  g.state.reveals.length = 0;
  for (const p of walk(11, 10_000, W)) g.state.reveals.push(p);
  T.bakeFog();
  T.setShip(W.cx, W.cy, 0, 0, 0);
  T.setTarget(W.cx + 1000, W.cy);

  const FRAMES = 600;
  // Warm up
  h.runFrames(60);
  const elapsed = timed(() => h.runFrames(FRAMES));
  const perFrame = elapsed / FRAMES;
  console.log(`   ${FRAMES} frames in ${fmt(elapsed)} = ${fmt(perFrame)}/frame`);
  // Frame budget at 60fps is 16.67ms; we want pure JS far under that.
  check('     per-frame JS', perFrame, 4);
}

// ---------------------------------------------------------------------------
// 4. saveState (JSON encode) cost as reveals grow. This runs every 1.5s in
//    the live game.
// ---------------------------------------------------------------------------
console.log('\n4. saveState cost:');
for (const N of [100, 1000, 10_000]) {
  g.state.reveals.length = 0;
  for (const p of walk(99, N, W)) g.state.reveals.push(p);
  // Time multiple iterations to get a stable read.
  const iters = N >= 10_000 ? 5 : 50;
  const elapsed = timed(() => { for (let i = 0; i < iters; i++) T.saveState(); });
  const perCall = elapsed / iters;
  console.log(`   N=${N.toString().padStart(6)}  save=${fmt(perCall).padStart(9)}  (avg of ${iters})`);
  check(`     saveState (N=${N})`, perCall, N <= 1000 ? 5 : 50);
}

h.close();

console.log(`\n${failures === 0 ? 'All thresholds met.' : `${failures} threshold(s) exceeded.`}`);
process.exit(failures === 0 ? 0 : 1);
