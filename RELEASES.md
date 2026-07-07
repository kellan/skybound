# Releases

Release cuts are recorded here (and as `release/*` branches) because the
remote-session git proxy can't push tags. To mint the real tags from a
normal clone:

```
git tag -a v0.1.0 1ad4307 -m "Navigation POC"
git tag -a v0.2.0 bb1b51f -m "The Landing Update"
git push origin v0.1.0 v0.2.0
```

## v0.2.0 — The Landing Update (`bb1b51f`, branch `release/v0.2.0`)

Dock at an island and go ashore: every island hosts a deterministic 3D
village (the tethered-village spike, vendored under `village/`).

- Land button appears while docked; Set Sail returns to the map
- villages are themed by island name modifiers — ash meadows (`asha`),
  overgrowth (`hollow`/`thorn`), craggy ground (`crag`/`reach`), bright
  tidewater (`tide`), a mine adit (`glen`/`dell`), a war banner (`helm`/`mel`)
- altitude layers change the weather: alpine light, snow pines, and craggy
  relief in the High Reaches; ember dusk, close fog, bog, and glowing
  mushrooms in the Hollow Deeps
- plain-map islands keep the classic village look (the map is the contract);
  each still gets subtle per-seed personality
- buildings are tap targets with a stub card; icon bubbles reassignable
- three.js loads only on first landing; the 2D game still works over file://
- real-browser smoke suite (`npm run test:browser`) joins CI
- `village-lab.html` is the diorama workbench (seed, count, layer, modifiers)

## v0.1.0 — Navigation POC (`1ad4307`)

The 2D map game before landing: free-flight navigation, permanent
fog-of-war, three altitude layers, ship hangar, shared ship/island art
(`ships.js` / `islands.js` + labs), save-schema migrations, JSDOM test
suite and CI.
