# Notes for Claude

## Ship and island art

Iterate on art and animation in the labs first (`ship-lab.html` for ships, `island-lab.html` for islands). Once a design reads right, promote it into the shared drawer file — `ships.js` or `islands.js` — which both the game and the labs render from. Don't add drawing code for shipped designs to `index.html` or copy drawers between files; the shared files are the single source of truth, and the labs keep local drawers only for experiments that haven't shipped. Island drawers render in blob-local space (center origin, baseline radius 36, `br` 0..1 breeze strength); callers place/scale via canvas transform.

The same convention covers the 3D landing village: iterate in `village-lab.html`, which drives the shared `village/village-view.js` module that the game embeds when you land. Village code is ES modules (three.js vendored in `village/vendor/`), so the lab and the landing feature need a server (`python3 -m http.server`); plain `file://` only covers the 2D map game.

## Preview links

When asked for a "preview" of a branch, return a raw.githack.com URL pointing at `index.html` on that branch, e.g.:

```
https://raw.githack.com/kellan/skybound/<branch-name>/index.html
```

raw.githack.com is preferred over htmlpreview.github.io because it handles external module imports more reliably.
