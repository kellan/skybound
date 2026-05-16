# Notes for Claude

## Preview links

When asked for a "preview" of a branch, return a raw.githack.com URL pointing at `index.html` on that branch, e.g.:

```
https://raw.githack.com/kellan/skybound/<branch-name>/index.html
```

raw.githack.com is preferred over htmlpreview.github.io because it handles external module imports more reliably.
