// ABOUTME: maps an island's character (name modifiers + altitude layer) to a
// ABOUTME: village theme — terrain colors, scenery mix, and extra props

import { PALETTE } from "./palette.js";

// --- tiny hex color helpers (no three.js dependency here) ---
function toRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]) {
  return "#" + [r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("");
}
export function lerpHex(a, b, t) {
  const ca = toRgb(a);
  const cb = toRgb(b);
  return toHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * t));
}

// Terrain palettes per modifier, in priority order — the first present wins
// (an isle can be both ashen and overgrown in name; the terrain reads as one
// thing). Only terrain/water/sky shift; buildings keep their warm look so a
// village still reads as a village.
const TERRAIN_THEMES = [
  {
    id: "asha", // cinder isle: ash meadow, scorched dirt, steel water
    colors: {
      grassLow: "#8c8060", grassHigh: "#b3a878", sand: "#a3906e",
      dirt: "#6e5a44", dirtDeep: "#48392b", water: "#9db4b8", sky: "#ecd9ba",
    },
  },
  {
    id: "hollow", // overgrown: deep lush greens, mossy banks
    colors: {
      grassLow: "#6d9852", grassHigh: "#9cc06e", sand: "#c9bc8a",
      water: "#7cb2c2", sky: "#ede6cd",
    },
  },
  {
    id: "crag", // craggy: thin pale sod over stone
    colors: {
      grassLow: "#94a175", grassHigh: "#bcc49b", sand: "#c6b892", sky: "#eee7d4",
    },
  },
  {
    id: "tide", // tidewashed: brighter water, wet pale banks
    colors: { sand: "#e7d6a8", water: "#7ec2d8", sky: "#efe9d6" },
  },
];

// Scenery mix per modifier; multipliers compose across modifiers.
const SCATTER_TWEAKS = {
  asha: { trees: 0.6, rocks: 2.4, tufts: 0.5 }, // trees are charred snags (see flora)
  hollow: { trees: 1.9, rocks: 0.8, tufts: 1.8 },
  crag: { trees: 0.55, rocks: 2.2, tufts: 0.8 },
};

// Extra props per modifier (additive, order = placement priority).
const PROPS = { helm: "banner", glen: "mine" };

// Altitude layers change the weather, not just the paint: each has its own
// palette wash AND its own light — sun color/angle, ambient, fog depth.
// Layer 1 (Cloud Sea) is the baseline warm afternoon.
const LAYER_TINTS = [
  { tint: "#f4f8f6", t: 0.55, sky: "#e9f1ee", water: "#a9cfd8" }, // 0 — High Reaches: thin pale alpine air
  null,                                                            // 1 — Cloud Sea
  { tint: "#3f3346", t: 0.42, sky: "#c99e72", water: "#4f6a78" }, // 2 — Hollow Deeps: amber dusk
];

export const LAYER_LIGHT = [
  { // High Reaches: cold clear noon, long sightlines
    sunColor: 0xffffff, sunIntensity: 2.3, sunPosition: [5, 12, 3],
    hemiSky: 0xeaf4ff, hemiGround: 0xbcc8b6, hemiIntensity: 1.0,
    fogNear: 22, fogFar: 48,
  },
  { // Cloud Sea: the spike's warm afternoon (baseline)
    sunColor: 0xffeecb, sunIntensity: 1.9, sunPosition: [6, 10, 4],
    hemiSky: 0xfff2d8, hemiGround: 0xb8a878, hemiIntensity: 0.85,
    fogNear: 18, fogFar: 40,
  },
  { // Hollow Deeps: low ember sun, dusk ambient, close fog
    sunColor: 0xff9655, sunIntensity: 1.35, sunPosition: [7.5, 4.5, 2.5],
    hemiSky: 0x9a7a9c, hemiGround: 0x453a52, hemiIntensity: 0.6,
    fogNear: 12, fogFar: 30,
  },
];

/**
 * character: { modifiers?: string[], layer?: number }
 * Returns { colors, scatter, props } — colors is a full PALETTE-shaped set
 * so the world/view can use it directly.
 */
export function themeFor(character = {}) {
  const modifiers = character.modifiers || [];
  const layer = character.layer ?? 1;

  const colors = { ...PALETTE };
  const terrain = TERRAIN_THEMES.find((th) => modifiers.includes(th.id));
  if (terrain) Object.assign(colors, terrain.colors);

  const scatter = { trees: 1, rocks: 1, tufts: 1 };
  for (const m of modifiers) {
    const tw = SCATTER_TWEAKS[m];
    if (!tw) continue;
    scatter.trees *= tw.trees;
    scatter.rocks *= tw.rocks;
    scatter.tufts *= tw.tufts;
  }

  const props = [];
  for (const m of modifiers) {
    if (PROPS[m] && !props.includes(PROPS[m])) props.push(PROPS[m]);
  }

  const layerTint = LAYER_TINTS[layer] || null;
  if (layerTint) {
    for (const key of ["grassLow", "grassHigh", "sand", "dirt", "dirtDeep"]) {
      colors[key] = lerpHex(colors[key], layerTint.tint, layerTint.t);
    }
    colors.water = lerpHex(colors.water, layerTint.water, 0.6);
    colors.sky = lerpHex(colors.sky, layerTint.sky, 0.85);
  }

  const light = LAYER_LIGHT[layer] || LAYER_LIGHT[1];

  // What grows: an ash isle burns regardless of altitude; otherwise the
  // layer decides (alpine up high, dusk flora down deep).
  const flora = modifiers.includes("asha")
    ? "charred"
    : layer === 0 ? "alpine" : layer === 2 ? "dusk" : "temperate";

  // Landscape relief: craggier hills in the thin air of the Reaches,
  // flatter boggy ground in the Deeps; crag isles are jagged everywhere.
  let hillAmp = layer === 0 ? 1.7 : layer === 2 ? 0.65 : 1;
  if (modifiers.includes("crag")) hillAmp *= 1.5;

  return {
    colors, scatter, props, light, flora,
    terrain: { hillAmp },
    extraLilyPads: modifiers.includes("tide"),
  };
}
