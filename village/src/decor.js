// ABOUTME: growth & decoration — per-building "settled" clutter, trees, rocks,
// ABOUTME: lily pads and the river bridge; the lived-in layer over the terrain

import * as THREE from "../vendor/three.module.js";
import { range, pick } from "./rng.js";
import { PALETTE } from "./palette.js";

function lambert(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function grassTuft(rng) {
  const tuft = mesh(
    new THREE.ConeGeometry(range(rng, 0.04, 0.07), range(rng, 0.08, 0.16), 5),
    lambert(pick(rng, [PALETTE.leaf, PALETTE.leafLight, PALETTE.leafDark]), { flatShading: true })
  );
  tuft.position.y = 0.04;
  tuft.rotation.set(range(rng, -0.15, 0.15), rng() * Math.PI, range(rng, -0.15, 0.15));
  tuft.castShadow = false;
  return tuft;
}

function flower(rng) {
  const g = new THREE.Group();
  const h = range(rng, 0.08, 0.14);
  g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, h, 4), lambert(PALETTE.leafDark), 0, h / 2, 0));
  const head = mesh(
    new THREE.SphereGeometry(0.035, 8, 6),
    lambert(pick(rng, [PALETTE.blossom, "#f5f0dd", "#e8c86a"])),
    0, h, 0
  );
  head.castShadow = false;
  g.add(head);
  return g;
}

function miniMushroom(rng) {
  const g = new THREE.Group();
  const h = range(rng, 0.05, 0.09);
  g.add(mesh(new THREE.CylinderGeometry(0.015, 0.02, h, 6), lambert(PALETTE.mushroomStem), 0, h / 2, 0));
  const cap = mesh(new THREE.SphereGeometry(0.045, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), lambert(PALETTE.mushroomCap), 0, h, 0);
  cap.scale.y = 0.7;
  g.add(cap);
  return g;
}

function strawberryBush(rng) {
  const g = new THREE.Group();
  const bush = mesh(new THREE.SphereGeometry(range(rng, 0.09, 0.13), 8, 6), lambert(PALETTE.leafDark, { flatShading: true }), 0, 0.07, 0);
  bush.scale.y = 0.7;
  g.add(bush);
  for (let i = 0; i < 3; i++) {
    const theta = rng() * Math.PI * 2;
    const b = mesh(new THREE.SphereGeometry(0.025, 6, 5), lambert(PALETTE.berry),
      Math.cos(theta) * 0.09, range(rng, 0.05, 0.11), Math.sin(theta) * 0.09);
    b.castShadow = false;
    g.add(b);
  }
  return g;
}

function grapeVinePost(rng) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 5), lambert(PALETTE.woodDark), 0, 0.15, 0));
  const foliage = mesh(new THREE.SphereGeometry(0.09, 7, 5), lambert(PALETTE.leaf, { flatShading: true }), 0, 0.3, 0);
  foliage.scale.set(1, 0.8, 1);
  g.add(foliage);
  for (let i = 0; i < 2; i++) {
    const cluster = mesh(new THREE.SphereGeometry(0.035, 6, 5),
      lambert(PALETTE.grape),
      range(rng, -0.06, 0.06), range(rng, 0.18, 0.24), range(rng, -0.06, 0.06));
    cluster.scale.y = 1.3;
    cluster.castShadow = false;
    g.add(cluster);
  }
  return g;
}

function logPile(rng) {
  const g = new THREE.Group();
  const logGeom = new THREE.CylinderGeometry(0.045, 0.045, 0.3, 8);
  logGeom.rotateZ(Math.PI / 2);
  const positions = [[-0.05, 0.045, 0], [0.05, 0.045, 0.01], [0, 0.125, 0.005]];
  for (const [x, y, z] of positions) {
    const log = mesh(logGeom.clone(), lambert(PALETTE.wood), x, y, z);
    log.rotation.y = range(rng, -0.1, 0.1);
    g.add(log);
  }
  return g;
}

function lanternPost(rng) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.42, 6), lambert(PALETTE.woodDark), 0, 0.21, 0));
  const lamp = mesh(
    new THREE.SphereGeometry(0.05, 8, 6),
    lambert(PALETTE.lantern, { emissive: 0xcc9933, emissiveIntensity: 0.7 }),
    0, 0.44, 0
  );
  lamp.castShadow = false;
  g.add(lamp);
  return g;
}

// Per-kind decoration recipes: what "settles in" around each building.
const SPECIALTIES = {
  mushroom: (rng) => miniMushroom(rng),
  cottage: (rng) => logPile(rng),
  hut: (rng) => lanternPost(rng),
  strawberryHouse: (rng) => strawberryBush(rng),
  tent: (rng) => grapeVinePost(rng),
};

const SPECIALTY_COUNT = { mushroom: 3, cottage: 1, hut: 1, strawberryHouse: 4, tent: 4 };

// Growth cluster for one building, in the building's local space so it
// drags along with it. dropToGround(localX, localZ) -> localY lets items
// hug the bulged terrain under the building.
export function buildGrowth(kind, rng, dropToGround) {
  const g = new THREE.Group();

  const place = (item, rMin, rMax, theta) => {
    const r = range(rng, rMin, rMax);
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    item.position.x += x;
    item.position.z += z;
    item.position.y += dropToGround(x, z);
    g.add(item);
  };

  const specialty = SPECIALTIES[kind];
  const n = SPECIALTY_COUNT[kind] || 2;
  const baseTheta = rng() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    // Specialties cluster on one side of the building, like the sketch's
    // strawberry patch by the A-frame.
    place(specialty(rng), 0.55, 0.85, baseTheta + (i / Math.max(n, 2)) * 1.6 + range(rng, -0.15, 0.15));
  }

  const tufts = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < tufts; i++) {
    place(grassTuft(rng), 0.45, 0.95, rng() * Math.PI * 2);
  }
  const flowers = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < flowers; i++) {
    place(flower(rng), 0.5, 0.95, rng() * Math.PI * 2);
  }

  return g;
}

// --- Free-standing scenery ---

export function roundTree(rng) {
  const g = new THREE.Group();
  const trunkH = range(rng, 0.3, 0.45);
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, trunkH, 7), lambert(PALETTE.wood), 0, trunkH / 2, 0));
  const blobs = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < blobs; i++) {
    const r = range(rng, 0.22, 0.34);
    const blob = mesh(
      new THREE.SphereGeometry(r, 9, 7),
      lambert(pick(rng, [PALETTE.leaf, PALETTE.leafLight]), { flatShading: true }),
      range(rng, -0.12, 0.12), trunkH + r * 0.7 + i * 0.14, range(rng, -0.12, 0.12)
    );
    g.add(blob);
  }
  return g;
}

export function pineTree(rng) {
  const g = new THREE.Group();
  const trunkH = range(rng, 0.2, 0.3);
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.06, trunkH, 7), lambert(PALETTE.wood), 0, trunkH / 2, 0));
  let y = trunkH;
  let r = range(rng, 0.28, 0.36);
  for (let i = 0; i < 3; i++) {
    const h = r * 1.3;
    g.add(mesh(new THREE.ConeGeometry(r, h, 9), lambert(PALETTE.pine, { flatShading: true }), 0, y + h * 0.42, 0));
    y += h * 0.5;
    r *= 0.72;
  }
  return g;
}

// --- Flora variants: what grows depends on where the island floats ---

export function snowPine(rng) {
  // A pine wearing snow: each tier is a green cone with a white cap cone.
  const g = new THREE.Group();
  const trunkH = range(rng, 0.2, 0.3);
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.06, trunkH, 7), lambert(PALETTE.woodDark), 0, trunkH / 2, 0));
  let y = trunkH;
  let r = range(rng, 0.28, 0.36);
  for (let i = 0; i < 3; i++) {
    const h = r * 1.3;
    g.add(mesh(new THREE.ConeGeometry(r, h, 9), lambert("#4f7350", { flatShading: true }), 0, y + h * 0.42, 0));
    const cap = mesh(new THREE.ConeGeometry(r * 0.82, h * 0.45, 9), lambert("#f4f6f2", { flatShading: true }), 0, y + h * 0.72, 0);
    cap.castShadow = false;
    g.add(cap);
    y += h * 0.5;
    r *= 0.72;
  }
  return g;
}

export function deadTree(rng, color = "#7a6a56") {
  // A bare snag: leaning trunk with a few crooked branch spikes.
  const g = new THREE.Group();
  const h = range(rng, 0.5, 0.8);
  const trunk = mesh(new THREE.CylinderGeometry(0.025, 0.05, h, 6), lambert(color, { flatShading: true }), 0, h / 2, 0);
  trunk.rotation.z = range(rng, -0.12, 0.12);
  g.add(trunk);
  const branches = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < branches; i++) {
    const bh = range(rng, 0.16, 0.3);
    const b = mesh(new THREE.CylinderGeometry(0.008, 0.02, bh, 5), lambert(color, { flatShading: true }));
    const theta = rng() * Math.PI * 2;
    const at = range(rng, 0.45, 0.9) * h;
    b.position.set(Math.cos(theta) * 0.05, at, Math.sin(theta) * 0.05);
    b.rotation.set(Math.cos(theta) * range(rng, 0.7, 1.2), 0, Math.sin(theta) * range(rng, 0.7, 1.2));
    g.add(b);
  }
  return g;
}

export function glowShroom(rng) {
  // Oversized dusk mushroom with a softly glowing cap — reads best in the
  // Hollow Deeps' low light.
  const g = new THREE.Group();
  const h = range(rng, 0.18, 0.32);
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.055, h, 7), lambert("#d8cfae"), 0, h / 2, 0));
  const cap = mesh(
    new THREE.SphereGeometry(range(rng, 0.11, 0.17), 9, 7, 0, Math.PI * 2, 0, Math.PI / 2),
    lambert("#8fd0c4", { emissive: 0x4fa08c, emissiveIntensity: 0.55 }),
    0, h, 0
  );
  cap.scale.y = 0.65;
  g.add(cap);
  return g;
}

export function palmTree(rng) {
  // A leaning palm: stacked tapering trunk segments drifting sideways,
  // topped with a fan of two-segment drooping fronds and a few coconuts.
  const g = new THREE.Group();
  const lean = rng() * Math.PI * 2;
  const leanAmt = range(rng, 0.12, 0.3);
  const segs = 5;
  const segH = range(rng, 0.11, 0.14);
  let x = 0, z = 0, y = 0;
  for (let i = 0; i < segs; i++) {
    const r0 = 0.05 - i * 0.006;
    const seg = mesh(new THREE.CylinderGeometry(r0 - 0.005, r0, segH, 6), lambert("#a98a63"), x, y + segH / 2, z);
    seg.rotation.set(Math.sin(lean) * leanAmt * 0.6, 0, -Math.cos(lean) * leanAmt * 0.6);
    g.add(seg);
    x += Math.cos(lean) * leanAmt * segH;
    z += Math.sin(lean) * leanAmt * segH;
    y += segH * 0.96;
  }
  const crown = new THREE.Group();
  crown.position.set(x, y + 0.02, z);
  const fronds = 6 + Math.floor(rng() * 3);
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rng() * 0.3;
    const frond = new THREE.Group();
    const inner = mesh(new THREE.BoxGeometry(0.26, 0.015, 0.09), lambert(pick(rng, [PALETTE.leaf, PALETTE.leafDark]), { flatShading: true }), 0.12, 0, 0);
    const outer = mesh(new THREE.BoxGeometry(0.22, 0.012, 0.06), inner.material, 0.32, -0.045, 0);
    outer.rotation.z = -0.55; // tip droops
    inner.rotation.z = 0.12;
    frond.add(inner, outer);
    frond.rotation.y = a;
    frond.rotation.z = range(rng, -0.1, 0.1);
    crown.add(frond);
  }
  for (let i = 0; i < 3; i++) {
    const a = rng() * Math.PI * 2;
    const nut = mesh(new THREE.SphereGeometry(0.032, 6, 5), lambert("#7a5c3a"), Math.cos(a) * 0.05, -0.03, Math.sin(a) * 0.05);
    nut.castShadow = false;
    crown.add(nut);
  }
  g.add(crown);
  return g;
}

export function fishingPier(rng) {
  // A couple of planks jutting off the island's rim with a tiny seated
  // fisher, rod bent over the drop — line running down toward the ocean
  // the whole world floats above. Built facing +z (caller aims it off-rim).
  const g = new THREE.Group();
  const plankMat = lambert(PALETTE.wood);
  const len = range(rng, 0.7, 0.9);
  for (const sx of [-0.09, 0.09]) {
    g.add(mesh(new THREE.BoxGeometry(0.16, 0.03, len), plankMat, sx, 0.05, len / 2 - 0.15));
  }
  // Posts at the outboard end.
  for (const sx of [-0.14, 0.14]) {
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), lambert(PALETTE.woodDark), sx, -0.04, len - 0.2));
  }
  // The fisher: cone body, sphere head, sitting near the end.
  const body = mesh(new THREE.ConeGeometry(0.075, 0.16, 7), lambert(pick(rng, ["#b56d4e", "#5f7d99", "#8a6d9c"]), { flatShading: true }), 0.02, 0.14, len - 0.32);
  g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.045, 8, 6), lambert("#e8c9a0"), 0.02, 0.26, len - 0.32);
  head.castShadow = false;
  g.add(head);
  // Rod: thin cylinder angled out over the edge, line hanging straight down.
  const rod = mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.5, 5), lambert("#6b4d31"), 0.06, 0.24, len - 0.14);
  rod.rotation.x = 1.05; // tip out past the planks
  g.add(rod);
  const line = mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.5, 4), lambert("#efe8da"), 0.06, 0.02, len + 0.09);
  line.castShadow = false;
  g.add(line);
  // A bucket for the catch.
  const bucket = mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.07, 8), lambert("#8a8a80"), -0.09, 0.09, len - 0.42);
  g.add(bucket);
  return g;
}

// --- Special-name props: the still-flying and the long-built ---

export function stoneKeep(rng) {
  // A squat crenellated tower — the castle the isle is named for.
  const g = new THREE.Group();
  const stone = lambert("#a8a294", { flatShading: true });
  const towerH = range(rng, 0.85, 1.05);
  g.add(mesh(new THREE.CylinderGeometry(0.26, 0.32, towerH, 9), stone, 0, towerH / 2, 0));
  // Crenellations: teeth around the parapet.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(mesh(new THREE.BoxGeometry(0.09, 0.09, 0.07), stone, Math.cos(a) * 0.24, towerH + 0.04, Math.sin(a) * 0.24));
  }
  // Arrow-slit glow and a doorway.
  const slit = mesh(new THREE.BoxGeometry(0.03, 0.12, 0.02), lambert(PALETTE.lantern, { emissive: 0xcc9933, emissiveIntensity: 0.6 }), 0, towerH * 0.62, 0.29);
  slit.castShadow = false;
  g.add(slit);
  g.add(mesh(new THREE.BoxGeometry(0.14, 0.2, 0.05), lambert("#3a2f22"), 0, 0.1, 0.3));
  // Pennant on a pole.
  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 5), lambert(PALETTE.woodDark), 0, towerH + 0.2, 0));
  const pennant = mesh(new THREE.ConeGeometry(0.05, 0.16, 4), lambert(PALETTE.flag), 0.07, towerH + 0.28, 0);
  pennant.rotation.z = -Math.PI / 2;
  pennant.castShadow = false;
  g.add(pennant);
  return g;
}

export function watchtower(rng) {
  // A tall wooden lookout with a beacon burning on the platform.
  const g = new THREE.Group();
  const legMat = lambert(PALETTE.woodDark);
  const h = range(rng, 1.2, 1.4);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = mesh(new THREE.CylinderGeometry(0.02, 0.03, h, 5), legMat, sx * 0.11, h / 2, sz * 0.11);
    leg.rotation.x = -sz * 0.08;
    leg.rotation.z = sx * 0.08;
    g.add(leg);
  }
  g.add(mesh(new THREE.BoxGeometry(0.34, 0.04, 0.34), lambert(PALETTE.wood), 0, h, 0));
  // Railings.
  for (const [sx, sz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    g.add(mesh(new THREE.BoxGeometry(sz ? 0.34 : 0.02, 0.02, sz ? 0.02 : 0.34), legMat, sx * 0.16, h + 0.08, sz * 0.16));
  }
  // The beacon: a brazier glowing hot.
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.06, 7), lambert("#4a4038"), 0, h + 0.06, 0));
  const flame = mesh(
    new THREE.ConeGeometry(0.05, 0.14, 7),
    lambert("#ffb347", { emissive: 0xff7722, emissiveIntensity: 1.1 }),
    0, h + 0.16, 0
  );
  flame.castShadow = false;
  g.add(flame);
  // Little peaked roof on posts.
  g.add(mesh(new THREE.ConeGeometry(0.26, 0.16, 4), lambert(PALETTE.cottageRoof, { flatShading: true }), 0, h + 0.34, 0));
  return g;
}

export function sunShrine(rng) {
  // A gilded sun-disc raised over a small stone cairn — the isle is
  // sun-blessed, and the shrine keeps it that way.
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const r = rock(rng);
    r.scale.multiplyScalar(0.8);
    r.position.set(range(rng, -0.12, 0.12), 0.01 + i * 0.045, range(rng, -0.12, 0.12));
    g.add(r);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.6, 6), lambert(PALETTE.woodDark), 0, 0.42, 0));
  const gold = lambert("#f2c14e", { emissive: 0xd99a2b, emissiveIntensity: 0.55 });
  const disc = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 16), gold, 0, 0.82, 0);
  disc.rotation.x = Math.PI / 2;
  disc.castShadow = false;
  g.add(disc);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const ray = mesh(new THREE.ConeGeometry(0.022, 0.09, 4), gold);
    ray.position.set(Math.cos(a) * 0.21, 0.82 + Math.sin(a) * 0.21, 0);
    ray.rotation.z = a - Math.PI / 2;
    ray.castShadow = false;
    g.add(ray);
  }
  return g;
}

export function giantFeathers(rng) {
  // Enormous moulted feathers planted where they fell — something vast
  // and winged passes over these isles.
  const g = new THREE.Group();
  const n = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    const f = new THREE.Group();
    const len = range(rng, 0.5, 0.8);
    const vane = mesh(new THREE.SphereGeometry(0.5, 8, 6), lambert(i === 0 ? "#f4f1e6" : pick(rng, ["#f4f1e6", "#e8dcc8"]), { flatShading: true }));
    vane.scale.set(0.12, len, 0.03);
    vane.position.y = len * 0.55;
    f.add(vane);
    const quill = mesh(new THREE.CylinderGeometry(0.008, 0.014, len * 0.7, 5), lambert("#d8cdb4"), 0, len * 0.25, 0.02);
    f.add(quill);
    f.position.set(range(rng, -0.25, 0.25), 0, range(rng, -0.25, 0.25));
    f.rotation.set(range(rng, -0.35, 0.35), rng() * Math.PI * 2, range(rng, -0.3, 0.3));
    g.add(f);
  }
  return g;
}

export function wyvernNest(rng, scorched) {
  // A ring of sticks (scorched on pyre isles) with eggs — the perch the
  // circling wyvern comes home to.
  const g = new THREE.Group();
  const stickMat = lambert(scorched ? "#4e4238" : PALETTE.woodDark);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rng() * 0.3;
    const stick = mesh(new THREE.CylinderGeometry(0.012, 0.018, range(rng, 0.22, 0.34), 5), stickMat,
      Math.cos(a) * 0.16, 0.05, Math.sin(a) * 0.16);
    stick.rotation.set(Math.sin(a) * 1.25, 0, Math.cos(a) * 1.25);
    g.add(stick);
  }
  for (let i = 0; i < 2; i++) {
    const egg = mesh(new THREE.SphereGeometry(0.055, 8, 6), lambert(scorched ? "#c9a06a" : "#e8e0cc"),
      range(rng, -0.05, 0.05), 0.06, range(rng, -0.05, 0.05));
    egg.scale.y = 1.25;
    egg.castShadow = false;
    g.add(egg);
  }
  if (scorched) {
    // Char marks around the nest.
    const scorch = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.005, 12), lambert("#3a322a"), 0, 0.002, 0);
    scorch.castShadow = false;
    g.add(scorch);
  }
  return g;
}

export function wyvern(rng, scorched) {
  // A low-poly wyvern built facing +x; the view flies it in a slow circle
  // over the village (wings and orbit animate — see village.flyers).
  const g = new THREE.Group();
  const hide = lambert(scorched ? "#8a4a3a" : "#5f7d6a", { flatShading: true });
  const body = mesh(new THREE.ConeGeometry(0.09, 0.42, 7), hide);
  body.rotation.z = -Math.PI / 2; // nose toward +x
  g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.06, 7, 6), hide, 0.24, 0.02, 0);
  g.add(head);
  const snout = mesh(new THREE.ConeGeometry(0.035, 0.1, 6), hide, 0.32, 0.01, 0);
  snout.rotation.z = -Math.PI / 2;
  g.add(snout);
  const tail = mesh(new THREE.ConeGeometry(0.035, 0.34, 6), hide, -0.32, 0.01, 0);
  tail.rotation.z = Math.PI / 2;
  g.add(tail);
  const wings = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    const membrane = mesh(new THREE.BoxGeometry(0.26, 0.015, 0.34), hide, 0, 0, side * 0.18);
    wing.add(membrane);
    const tip = mesh(new THREE.BoxGeometry(0.18, 0.012, 0.2), hide, 0.02, 0, side * 0.42);
    tip.rotation.x = side * 0.25;
    wing.add(tip);
    wing.position.set(-0.02, 0.03, 0);
    g.add(wing);
    wings.push(wing);
  }
  g.userData.wings = wings;
  return g;
}

// Tree mix per flora kind; each returns a make(rng) suited to the theme.
// leafyRatio varies per island: how much of a temperate wood is round
// broadleaf vs pine.
export function treeMakerFor(flora, leafyRatio = 0.55) {
  switch (flora) {
    case "alpine": // snowy pines with the odd bare snag, no leafy rounds
      return (rng) => (rng() < 0.75 ? snowPine(rng) : deadTree(rng, "#8a7d6a"));
    case "shore": // the low layer, close over the ocean: palms and broadleaf
      return (rng) => (rng() < 0.7 ? palmTree(rng) : roundTree(rng));
    case "dusk": // gnarled snags and glowing shrooms — parked, no layer uses
      return (rng) => { // it since the Deeps became the shore (kept for the lab)
        const roll = rng();
        if (roll < 0.4) return deadTree(rng, "#5c5060");
        if (roll < 0.75) return glowShroom(rng);
        return pineTree(rng);
      };
    case "charred": // ash isles keep only burnt snags
      return (rng) => deadTree(rng, "#4e4238");
    default: // temperate — leafy/pine balance is per-island
      return (rng) => (rng() < leafyRatio ? roundTree(rng) : pineTree(rng));
  }
}

export function rock(rng) {
  const m = mesh(
    new THREE.DodecahedronGeometry(range(rng, 0.07, 0.16)),
    lambert(PALETTE.rock, { flatShading: true })
  );
  m.scale.set(1, range(rng, 0.5, 0.8), 1);
  m.rotation.y = rng() * Math.PI;
  m.position.y = 0.02;
  return m;
}

export function lilyPad(rng, withFlower) {
  const g = new THREE.Group();
  const pad = mesh(new THREE.CylinderGeometry(range(rng, 0.09, 0.14), range(rng, 0.09, 0.14), 0.015, 12), lambert(PALETTE.leaf));
  pad.castShadow = false;
  g.add(pad);
  if (withFlower) {
    const bud = mesh(new THREE.ConeGeometry(0.045, 0.08, 7), lambert(PALETTE.blossom), 0, 0.045, 0);
    bud.castShadow = false;
    g.add(bud);
  }
  return g;
}

// --- Modifier props: what an island's name plants in its village ---
// These mirror the 2D map art (islands.js): helm/mel isles fly a war banner,
// glen/dell isles work a timber-framed mine.

export function warBanner(rng) {
  const g = new THREE.Group();
  const poleH = range(rng, 1.15, 1.35);
  g.add(mesh(new THREE.CylinderGeometry(0.022, 0.03, poleH, 6), lambert(PALETTE.woodDark), 0, poleH / 2, 0));
  g.add(mesh(new THREE.SphereGeometry(0.035, 6, 5), lambert(PALETTE.lantern), 0, poleH + 0.02, 0));

  // Swallow-tailed banner: a flat shape hung from the pole top.
  const shape = new THREE.Shape();
  const w = 0.52, h = 0.24, notch = 0.14;
  shape.moveTo(0, 0);
  shape.lineTo(w, 0);
  shape.lineTo(w - notch, -h / 2);
  shape.lineTo(w, -h);
  shape.lineTo(0, -h);
  shape.closePath();
  const banner = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    lambert(PALETTE.flag, { side: THREE.DoubleSide })
  );
  banner.position.set(0.03, poleH - 0.04, 0);
  banner.rotation.y = range(rng, -0.25, 0.25);
  banner.castShadow = true;
  g.add(banner);

  for (let i = 0; i < 3; i++) {
    const r = rock(rng);
    r.position.set(range(rng, -0.18, 0.18), 0.01, range(rng, -0.18, 0.18));
    g.add(r);
  }
  return g;
}

export function mineAdit(rng) {
  const g = new THREE.Group();
  const postH = 0.34, width = 0.42;

  // Dark opening set into the hillside behind the frame.
  const mouth = mesh(new THREE.BoxGeometry(width, postH, 0.26), lambert("#241a10"), 0, postH / 2 - 0.02, -0.12);
  mouth.castShadow = false;
  g.add(mouth);

  // Timber frame: two posts and a lintel, like the map art's adit.
  for (const sx of [-width / 2, width / 2]) {
    g.add(mesh(new THREE.BoxGeometry(0.06, postH, 0.06), lambert(PALETTE.wood), sx, postH / 2, 0));
  }
  g.add(mesh(new THREE.BoxGeometry(width + 0.16, 0.06, 0.08), lambert(PALETTE.woodDark), 0, postH + 0.02, 0));

  // Hanging lantern under the lintel.
  const lamp = mesh(
    new THREE.SphereGeometry(0.035, 8, 6),
    lambert(PALETTE.lantern, { emissive: 0xcc9933, emissiveIntensity: 0.8 }),
    0, postH - 0.06, 0.02
  );
  lamp.castShadow = false;
  g.add(lamp);

  // Spoil: ore rocks and a stray log by the entrance.
  for (let i = 0; i < 4; i++) {
    const r = rock(rng);
    r.position.set(range(rng, -0.3, 0.3), 0.01, range(rng, 0.14, 0.4));
    g.add(r);
  }
  const log = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 7), lambert(PALETTE.wood), 0.24, 0.04, 0.3);
  log.rotation.z = Math.PI / 2;
  log.rotation.y = range(rng, -0.4, 0.4);
  g.add(log);
  return g;
}

// Arched plank bridge across the river at a given point, oriented across
// the flow. heightAtEnd gives the bank height so the ends sit on land.
export function buildBridge(center, acrossDir, span, heightAtEnd) {
  const g = new THREE.Group();
  const planks = 9;
  const plankMat = lambert(PALETTE.wood);
  const railMat = lambert(PALETTE.woodDark);
  const arc = 0.14;

  // Arc profile that touches the banks at both ends.
  const lift = (s) => arc * (Math.cos((s * Math.PI) / 2.4) - Math.cos(Math.PI / 2.4));
  for (let i = 0; i < planks; i++) {
    const t = i / (planks - 1); // 0..1 across
    const s = t * 2 - 1; // -1..1
    const y = heightAtEnd + 0.03 + lift(s);
    const p = mesh(new THREE.BoxGeometry(0.4, 0.035, span / planks + 0.015), plankMat, 0, y, s * (span / 2));
    p.rotation.x = -Math.sin((s * Math.PI) / 2.4) * 0.3;
    g.add(p);
  }
  // Rails: posts at each end plus a beam per side.
  for (const sx of [-0.18, 0.18]) {
    for (const sz of [-span / 2, span / 2]) {
      g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 6), railMat, sx, heightAtEnd + 0.11, sz));
    }
    const beam = mesh(new THREE.BoxGeometry(0.025, 0.025, span), railMat, sx, heightAtEnd + 0.2 + arc * 0.35, 0);
    g.add(beam);
  }

  g.position.set(center.x, 0, center.z);
  g.rotation.y = Math.atan2(acrossDir.x, acrossDir.z);
  return g;
}
