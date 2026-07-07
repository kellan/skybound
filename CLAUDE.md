# Notes for Claude

## Ship art and animation

Iterate on ship art and animation in `ship-lab.html` first. Once a design reads right in the lab, promote it into `ships.js` — the shared drawer file both the game and the lab render from. Don't add drawing code for shipped designs to `index.html` or copy drawers between files; `ships.js` is the single source of truth, and the lab keeps its own local drawers only for experiments that haven't shipped.

## Preview links

When asked for a "preview" of a branch, return a raw.githack.com URL pointing at `index.html` on that branch, e.g.:

```
https://raw.githack.com/kellan/skybound/<branch-name>/index.html
```

raw.githack.com is preferred over htmlpreview.github.io because it handles external module imports more reliably.
