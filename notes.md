# Skybound — Navigation POC

A proof of concept for a larger game project. Web-based, mobile-first (vertical orientation), exploring slow flight between procedurally placed islands with permanent fog-of-war reveal. 

## World fiction (canon)

The game adapts a story by the developer's kid, and her artwork is the visual source material. What's canon so far, and what it implies for design:

- **The islands float above an endless ocean — there is no land below.** The whole world is sky islands stacked over open sea.
- **Altitude is climate.** Climbing gets colder and clearer; descending gets warmer and more maritime. This is why the High Reaches read alpine (snow pines, thin pale air) and the Hollow Deeps read as a shore (golden light, sea haze, palms) — *not* dark. An earlier "dusky deeps" look was retired for contradicting this; it's parked in `decor.js` as the unused `dusk` flora.
- **The lowest islands live off the sea.** Her artwork shows palm trees on some islands and people fishing off the lower ones — hence the fishing piers on low-layer village rims, rods and lines hanging toward the water below.
- **Open questions to resolve with her** as they come up: what's at the very bottom (can you see or reach the ocean surface? is that why you can't descend further?), what's above the High Reaches, and whether named characters/places from the story should appear as fixed content in the procedural world.

When new story details arrive, they win over anything we invented — record them here first, then align the game.

## Current state

A single-file HTML/JS/CSS prototype at `index.html`. Zero dependencies, no build step. Works in any modern browser including iOS WKWebView (Claude's in-app web viewer). Deployed via GitHub Pages from `main` so each push is testable at a live URL.

### What's implemented

- **Procedural map**: islands placed with min-distance rejection inside an oval play area, seeded RNG (mulberry32). Two presets: small (3600×2800, 22 islands per layer) and large "Grand Voyage" (7200×5600, 88 per layer)
- **Three altitude layers** (High Reaches / Cloud Sea / Hollow Deeps): the world is a stack of independently generated layers, each with its own islands and fog mask, deterministic per (seed, layer). Ships spawn on the middle layer; ascend/descend buttons run a ~2.5s veiled transition that swaps the active layer at the visual peak and drops a reveal stamp where the ship emerges. The landing villages now differ fully per layer (altitude-as-climate, see World fiction and village theming); the 2D map still renders every layer the same — carrying the climate onto the map is an open direction (see below)
- **The Skywright's Stable** (was: menu hangar): mounts are creatures and craft that live somewhere, so swapping happens ashore — tap the Skywright's Tent in a village. What's stabled is deterministic per (voyage, island): every mount favors a home altitude (wyvern and wind serpent in the High Reaches; sloop, butterfly, and cloud galleon on the Cloud Sea; sea turtle, manta, and jellyfish down at the shore), appears often on its home layer and rarely elsewhere, and each is *guaranteed* stabled at one isle of its home layer per voyage so the full collection is always findable. Visiting a stable records its mounts in `mountsSeen` — the collection meter. Mount art still iterates in `ship-lab.html` first
- **Trading — barter between altitudes, no coin**: every island produces a good (its layer's staple — glacier ice, skywheat, salt fish — or a rarer one if its name marks it: iron ore on glen isles, wild berries on hollow, ashglass on asha, pearls on tide) and *wants* a staple from a different altitude, deterministic per island. The Workshop card takes goods aboard and accepts deliveries; the hold has no capacity and there are no prices — grateful villages pay in knowledge, marking an unfound isle on your chart (specials preferred), once per island per voyage. `hold`/`delivered` live in the save (schema v5 with a v4→v5 migration)
- **Voyage ledger**: the Captain's Log badge counts discoveries across all three altitudes, and the chart footer tracks the whole voyage — isles found, mounts seen (n/8), deliveries made
- **Landing**: dock at an island and a Land button appears; going ashore opens a full-screen 3D village diorama (the "tethered village" spike from the separate `village` repo, vendored under `village/`). Each island's village is deterministic — seed mixed from the voyage seed + the island's saved x/y/shape, building count scaled from island radius (3–9) — so revisits land on the same village with nothing extra saved. Buildings are tap targets with a stub card where the game's building UI will live; icon bubbles are reassignable for concept sketching. The three.js view is dynamically imported on first landing and torn down on Set Sail, so the 2D map game stays dependency-free until you land (and degrades to a note where modules/WebGL aren't available); the 2D loop pauses while ashore. Iterate on the diorama in `village-lab.html`
- **Rumors — the first thing to *do* ashore**: village building cards can carry game actions (the view takes `actionFor`/`onAction` hooks). The Noodle House offers "Ask for rumors": a sailor points out an isle you haven't found — the fog parts over it, and an ✕ marks the spot on both the map and the chart (with a faint unnamed "hearsay" dot on the chart) until you actually get there. Half of all rumors (deterministic per voyage/ask-order) point at a *special* isle — one whose name modifiers give it distinct map art — and the tale says why it's worth the trip ("a fire-scarred isle…", "a mine-riddled isle…"); the rest point at the nearest unfound isle, which is also the fallback when no specials remain. Once per island per voyage; rumors are stored as `{at, layer, x, y, dir, dist}` in the save (schema v4 with a v3→v4 migration), so asking again repeats the same tale instead of losing the lead, and markers survive reloads. Discovery proper (the name, the log count) still requires sailing there. This is deliberately the thinnest possible loop that makes landing *matter*; more building roles hang off the same hooks
- **Village theming** (`village/src/theme.js`): the island's identity shapes its village. Name modifiers pick terrain palettes, scenery mixes, flora, and props — `asha` = ash meadow with charred snags, `hollow` = dense overgrowth, `crag` = stony ground with jagged relief, `tide` = bright water and lily-pad mats, `glen` = a timber-framed mine adit, `helm` = a war banner. The altitude layer changes the *weather*, not just paint — the world floats above an endless ocean, so climbing gets colder and descending gets warmer and maritime: High Reaches get crisp white alpine light, snow-capped pines, and craggier hills; the Hollow Deeps are the shore layer — golden beach light, sea haze, sun-bleached ground, turquoise water, coconut palms, and fishing piers off the island rims with little fishers working the ocean below (per the kiddo's original artwork). An earlier dusk look for the Deeps (ember sun, snags, glowing mushrooms) is parked in `decor.js` as the unused `dusk` flora, in case a darker layer ever wants it. The remaining modifiers (`keep`, `wing`, `sol`, `spire`, `wyn`, `pyre`) are still terrain-neutral — each wants its own prop/scene work in the lab. New building *kinds* per world are the next content push; the existing five already read differently under each layer's light
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
- **Two mulberry32 implementations, on purpose (for now)** — the game's inline `rng()` (classic script) and `village/src/rng.js` (ES module) are the same algorithm on opposite sides of the script-type boundary. Sharing one copy means either making the game consume ES modules or the village consume globals; neither is worth it until the monolith modularizes. Revisit then.
- **Village icon reassignments don't persist** — the bubble picker is a concept-sketching tool (inherited from the spike), not game state. Deciding what a building's role *means* belongs to the future building UI; persisting sketches now would bake in a save-schema shape we'd have to migrate away from.
- **The 2D map is the contract for village looks** — a plain-looking island in the HUD lands on what reads as the classic default meadow (only subtle per-seed personality: grass shade, tree balance, river breadth within ~±15%). Dramatic village themes are reserved for character the player can already see before landing: name modifiers (which draw volcanoes/mines/banners on the map blob) and the altitude layer (on the altimeter). If we later want every village wildly distinct, the map art has to telegraph it first (the "biome tints" next-direction), not the other way around.

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

`npm run test:browser` runs `test/browser/landing.smoke.mjs` in real headless Chromium (Playwright): serves the repo, boots the actual game, docks, lands, and asserts the three.js village mounted and submitted geometry, then that the lab boots. This covers the WebGL half that JSDOM can't reach. Locally it uses the sandbox's preinstalled Chromium (`/opt/pw-browsers/chromium`); CI installs Playwright's own build (see `.github/workflows/test.yml`).

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
- Give the altitude layers distinct character: started — landing villages now differ fully per layer (palette, light, flora, relief; see village theming above), but the 2D map itself still renders every layer the same. Map-side palette/lighting per layer (cold pale sky up high, warm sea-glow below, per the altitude-as-climate canon), layer-specific island types or hazards, and altitude-varying wind are still open — turn ascend/descend into a decision rather than a toggle
- The ocean below (canon): the Hollow Deeps sit just above the sea, which suggests the bottom layer's map could show water glinting under the fog instead of the same dark void, and gives descent a natural floor ("the ocean is right there"). What being *on* the water means — if anything — is a story question first
- Varied island appearance: size tiers, shape archetypes, biome tints
- Non-island points of interest: wrecks, storm cells, anomalies, beacons, ruins
- Named regions that announce themselves when entered ("The Hollow Reaches…")
- Map edges that feel meaningful (a wall of cloud? open sea?) rather than hard-clamping

### Game systems (seeding the bigger project)
- Cargo/inventory with weight affecting top speed
- Trade economy: each island has buy/sell prices that drift over time
- Fuel/stamina so voyages have stakes
- Quest hooks: an island gives a delivery target, a rumor, a passenger to carry — started: the Noodle House rumor (see above); delivery/passenger hooks are the natural next roles for the Workshop / Inn / tent
- Crew, ship upgrades, faction reputation — longer-term progression

### Tech foundations
- Save schema versioning — done: saves carry a `schemaVersion` that upgrades through a migrations table on load (the pre-altitude v2 format is migrated into the layered world — old voyage becomes the middle layer — instead of being deleted). Future shape changes bump `SAVE_SCHEMA` and add a step; the localStorage key stays frozen
- Split the monolith into modules — started: ship art lives in a shared `ships.js` and island art in a shared `islands.js` (classic scripts so `file://` keeps working), each used by both the game and its lab. Unifying island art also brought the lab's newer work into the game: lava-crack detailing on volcanic blobs, and three modifiers the game never wired up (mine for glen/dell names, overgrowth for hollow/thorn, war banner for helm/mel). Next candidate: the stateful core (`<script type="module">` is the lightest path; a real build with Vite or esbuild if it grows)
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
