# Skybound

A web-based navigation POC: slow flight between procedurally placed sky islands with permanent fog-of-war reveal, across a stack of altitude layers. Mobile-first, single-file, no build step.

Open `index.html` in a browser, or play the deployed version via GitHub Pages.

## Repo layout

- `index.html` — the game. Everything (CSS, HTML, JS) lives in this file, except the ship art.
- `ships.js` — the shipped ship drawers, shared by the game and the ship lab so the two can't drift apart. Loaded as a classic script (no build step, works over `file://`).
- `ship-lab.html` — standalone workbench for iterating on ship art and animation. Try designs here first; promote them into `ships.js` once they read right.
- `island-lab.html` — same idea for island shapes and name-modifier visuals.
- `test/` — Node test suite (JSDOM harness that boots the real `index.html`).

## Tests

```
npm install
npm test
```

The suite boots `index.html` in JSDOM with a canvas shim and a deterministic clock, then drives frames through the `window.__game` test seams. CI runs it on every push (`.github/workflows/test.yml`).

See [notes.md](notes.md) for design notes, implementation details, and next directions.
