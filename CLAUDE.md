# Notes for Claude

## Ship art and animation

Iterate on ship art and animation in `ship-lab.html` first. Only port a design into `index.html` once it reads right in the lab. The lab is the cheap, isolated place to try things; the game is where proven results land.

## Preview links

When asked for a "preview" of a branch, return a raw.githack.com URL pointing at `index.html` on that branch, e.g.:

```
https://raw.githack.com/kellan/skybound/<branch-name>/index.html
```

raw.githack.com is preferred over htmlpreview.github.io because it handles external module imports more reliably.
