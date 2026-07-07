# Skybound — Navigation POC

A proof of concept for a larger game project. Web-based, mobile-first (vertical orientation), exploring slow flight between procedurally placed islands with permanent fog-of-war reveal. 

## Current state

A single-file HTML/JS/CSS prototype at `index.html`. Zero dependencies, no build step. Works in any modern browser including iOS WKWebView (Claude's in-app web viewer). Deployed via GitHub Pages from `main` so each push is testable at a live URL.

### What's implemented

- **Procedural map**: islands placed with min-distance rejection inside an oval play area, seeded RNG (mulberry32). Two presets: small (3600×2800, 22 islands per layer) and large "Grand Voyage" (7200×5600, 88 per layer)
- **Three altitude layers** (High Reaches / Cloud Sea / Hollow Deeps): the world is a stack of independently generated layers, each with its own islands and fog mask, deterministic per (seed, layer). Ships spawn on the middle layer; ascend/descend buttons run a ~2.5s veiled transition that swaps the active layer at the visual peak and drops a reveal stamp where the ship emerges. Layers currently differ only in name — giving them distinct character is an open direction (see below)
- **Ship hangar**: dock at an island to swap between ship designs (drawn procedurally on canvas; art iterated in `ship-lab.html` first)
- **Free-form 2D flight**: ship has continuous position, velocity, and heading
- **Tap-anywhere navigation**: tap empty sky to chart a course there, tap a discovered island to target it directly
- **Physics-driven steering**:
  - Gradual turning (~1.4 rad/sec, with a small boost at low speed for responsive course corrections)
  - Cruise/brake state machine based on calculated stopping distance (`s = v²/2a`)
  - Lateral velocity damping projects motion onto the heading axis and kills perpendicular drift — this is what prevents the ship from orbiting its destination
  - Soft drift on arrival (residual velocity damped to 30%)
  - Idle drag when no target (exponential decay)
- **Permanent fog-of-war**: offscreen mask canvas at 25% world resolution, `destination-out` composite stamps soft-edged reveal circles along the ship's path. Stamps stored as a list of points so the mask can be rebaked on load
- **Island discovery**: islands within 140px get a discovered flag and show their procedural name
- **Camera**: smoothed follow (exponential lerp), centered on ship
- **HUD**: top-bar captain's log + compass with rotating needle, bottom-bar status card with heading/destination/distance, all parchment-styled
- **Persistence**: localStorage saves seed, islands, ship position, target, reveal stamps; auto-saves every 1.5s
- **New Voyage button**: wipes save and generates a new map
- **Debug subsystem** (toggleable, lower-left `D` button, also triple-tap-top-of-screen):
  - Live stats: boot steps, frame count, fps, view size, ship state, camera, target, reveal count, error count
  - Scrollable timestamped log with color-coded levels (err/warn/info/ok)
  - Global error capture for `error` and `unhandledrejection` events
  - Action buttons: clear log, wipe save, teleport random, reveal all, copy log to clipboard
  - Red error pill appears in the top bar when errors fire and the panel is closed

### Decisions made along the way

- **Free-form 2D over hex/grid** — chose continuous motion to match the actual feel of Merchant of the Skies (I initially misremembered it as hex-based; user corrected this).
- **Plain canvas over Pixi for the POC** — with one ship and ~22 static islands there's no rendering bottleneck Pixi would solve, and the dep tree is friction. Pixi becomes worthwhile once we have animated sprites, particles, or shader-based fog.
- **Steering feel: gradual turn + drift on stop** (vs. instant or pure-arcade).
- **Visual polish: placeholder shapes** for the POC, but with an intentional aesthetic — parchment/explorer's-map HUD, soft fog edges, vignette, drifting cloud highlights. "Placeholder" doesn't mean "ugly."
- **Tap anywhere, not just islands** — explorer feel rather than trade-route feel.
- **Non-fixed map, localStorage only** — no server side for the POC.

### Bugs found and fixed

1. **`drawImage` IndexSizeError near world edges**: source rect could exceed the fog canvas bounds, killing the render loop after one frame. Fix: clamp source/destination rects together so it stays in-bounds.
2. **Set Sail button did nothing in iOS WKWebView**: `touch-action: none` on `<body>` was suppressing the synthesized `click` event after a touch sequence. Fix: scope `touch-action: none` to the canvas only, set `touch-action: manipulation` on buttons, and bind multiple event types (`touchend`, `click`, `pointerup`) as redundant handlers.
3. **Ship overshoots and circles target**: original code reduced thrust near target but had no active braking, so the ship coasted in at near-max speed. Fix: physics-based brake distance, lateral velocity damping, and a small "creep" thrust within 40px to ensure clean arrival.

### Testing approach

`npm install && npm test` runs a `node --test` suite under `test/`. The harness (`test/helpers/harness.js`) boots the real `index.html` into JSDOM with a canvas-API shim, a deterministic clock, and a hand-driven requestAnimationFrame queue, then reads and drives the game through the `window.__game` / `_test` seams. This catches logic, DOM, event-handler, and script-execution issues but not real-browser rendering or platform-specific event quirks. Suites:

- `boot-physics.test.js` — boot/DOM presence, Set Sail flow, arrival-without-overshoot and 180°-reversal physics, island discovery
- `save-load.test.js` — save round-trip, corrupt-save fallback, debug wipe
- `stamps-dedup.test.js` — fog reveal stamping and the spatial dedup grid
- `altitude.test.js` — layer transitions
- `ui-clicks.test.js` — HUD and input wiring
- `perf.bench.js` (`npm run bench`) — frame-cost benchmark, not part of the test run

CI runs the suite on every push (`.github/workflows/test.yml`). Claude's remote sandbox now ships Chromium with Playwright preconfigured, so real-browser smoke tests are possible as a future layer on top of the JSDOM suite. iOS-specific issues still require live testing in the Claude app's web viewer; the on-screen debug panel was built precisely because devtools aren't accessible there.

## Tech stack

- Plain HTML / CSS / JavaScript, single file
- No build step, no dependencies
- Canvas 2D API for rendering
- localStorage for persistence
- Mobile-first vertical layout with safe-area-inset support

## Potential next directions

### Feel & polish
- Wind/current vectors that nudge the ship — gives the world texture and makes some routes harder
- Better ship sprite (still placeholder-tier) with subtle bob/sway, smoke or sail flutter when moving
- Audio: ambient wind, soft thump on arrival, faint click on tap
- Camera lead — offset ahead of the ship in its travel direction so you see more of where you're going
- Smoothed compass needle (currently snaps slightly)
- **Wind serpent turn animation**: current bunch-and-extend is functional but the coil reads as "shrink then grow", not as a creature really coiling on itself. Worth more iteration in `ship-lab.html` — try variants like spiraling segments tightening around the head (helical), or segments piling on each other (recoiling spring), or the head dipping down + tail flicking up through the turn. The serpent's drawer now lives in the shared `ships.js` (the turn animation drives off the `facingLeft` arg); the lab has no per-card Turn button yet, so building one is the first step to iterating on this.

### World content
- Give the altitude layers distinct character: palette/lighting per layer, layer-specific island types or hazards, wind that varies by altitude — turn ascend/descend into a decision rather than a toggle
- Varied island appearance: size tiers, shape archetypes, biome tints
- Non-island points of interest: wrecks, storm cells, anomalies, beacons, ruins
- Named regions that announce themselves when entered ("The Hollow Reaches…")
- Map edges that feel meaningful (a wall of cloud? open sea?) rather than hard-clamping

### Game systems (seeding the bigger project)
- Cargo/inventory with weight affecting top speed
- Trade economy: each island has buy/sell prices that drift over time
- Fuel/stamina so voyages have stakes
- Quest hooks: an island gives a delivery target, a rumor, a passenger to carry
- Crew, ship upgrades, faction reputation — longer-term progression

### Tech foundations
- Save schema versioning so the format can evolve without nuking saves
- Split the monolith into modules — started: ship art now lives in a shared `ships.js` (classic script so `file://` keeps working) used by both the game and `ship-lab.html`. Next candidates: island art (still duplicated with `island-lab.html`), then the stateful core (`<script type="module">` is the lightest path; a real build with Vite or esbuild if it grows)
- Migrate rendering to Pixi once we have animated sprites, particles, or shaders
- Asset pipeline (sprite atlases, audio sprites)
- Service worker for offline play
- Optional: lightweight server later for shared world state, leaderboards, or persistent multiplayer

### Things to validate with real users
- Does the slow movement feel meditative or tedious?
- Is permanent reveal satisfying long-term, or should fog re-condense in unexplored bands?
- Should taps in fog be allowed (current behavior) or only on revealed terrain?
- Mobile ergonomics: is the bottom HUD readable on small phones with one-handed use?

## Repo suggestions

A minimal structure:

```
skybound-poc/
├── README.md              # this content
├── index.html             # current skybound-poc.html, renamed
├── .gitignore             # node_modules, .DS_Store, etc.
└── docs/
    └── design-notes.md    # decisions log, expanded
```

If/when it grows past one file:

```
skybound-poc/
├── index.html
├── src/
│   ├── main.js
│   ├── world.js           # seed, islands, generation
│   ├── ship.js            # physics
│   ├── render.js          # camera, draw passes
│   ├── fog.js             # mask logic
│   ├── input.js           # tap handling
│   ├── hud.js             # DOM HUD updates
│   └── debug.js           # debug subsystem
├── assets/                # sprites, audio when we get there
├── docs/
└── README.md
```

For a single-file POC, GitHub Pages serves it for free with zero config — push to `main`, enable Pages, done.
