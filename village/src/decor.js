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
