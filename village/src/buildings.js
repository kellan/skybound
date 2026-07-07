// ABOUTME: the five hand-modeled building types from the sketch, each ~1 unit tall
// ABOUTME: builders return a THREE.Group with userData.icon for the speech-bubble label

import * as THREE from "../vendor/three.module.js";
import { range } from "./rng.js";
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

// Arched door: a box with a half-cylinder top, sitting slightly proud of
// the wall it faces (+z in local space before the group is rotated).
function makeDoor(width, height, color, depth = 0.02) {
  const g = new THREE.Group();
  const mat = lambert(color);
  const body = mesh(new THREE.BoxGeometry(width, height - width / 2, depth), mat, 0, (height - width / 2) / 2, 0);
  const arch = mesh(
    new THREE.CylinderGeometry(width / 2, width / 2, depth, 12, 1, false, 0, Math.PI),
    mat,
    0,
    height - width / 2,
    0
  );
  arch.rotation.x = Math.PI / 2;
  arch.rotation.z = Math.PI;
  g.add(body, arch);
  return g;
}

function makeRoundWindow(radius, color = "#fdf6e3") {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(radius, radius, 0.02, 12), lambert(PALETTE.woodDark)));
  g.add(mesh(new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, 0.025, 12), lambert(color, { emissive: 0x554411 })));
  g.children.forEach((c) => (c.rotation.x = Math.PI / 2));
  return g;
}

function makeSquareWindow(size, color = "#fdf6e3") {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(size, size, 0.02), lambert(PALETTE.woodDark)));
  g.add(mesh(new THREE.BoxGeometry(size * 0.7, size * 0.7, 0.03), lambert(color, { emissive: 0x554411 })));
  return g;
}

// Triangular prism (gabled roof / A-frame), ridge along the z axis.
function makePrism(width, height, depth, material) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geom.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geom, material);
  m.castShadow = true;
  return m;
}

// --- 🍜 Mushroom noodle house ---
function mushroom(rng) {
  const g = new THREE.Group();

  const stem = mesh(
    new THREE.CylinderGeometry(0.24, 0.32, 0.52, 12),
    lambert(PALETTE.mushroomStem),
    0, 0.26, 0
  );
  g.add(stem);

  const capMat = lambert(PALETTE.mushroomCap);
  const cap = mesh(
    new THREE.SphereGeometry(0.58, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    capMat,
    0, 0.5, 0
  );
  cap.scale.y = 0.72;
  g.add(cap);
  const capRim = mesh(new THREE.CylinderGeometry(0.58, 0.52, 0.07, 20), lambert("#a8443a"), 0, 0.48, 0);
  g.add(capRim);

  // Spots sit on the cap surface.
  for (let i = 0; i < 6; i++) {
    const theta = (i / 6) * Math.PI * 2 + range(rng, -0.3, 0.3);
    const phi = range(rng, 0.35, 1.1);
    const spot = mesh(
      new THREE.SphereGeometry(range(rng, 0.06, 0.1), 10, 8),
      lambert(PALETTE.mushroomSpot),
      0.57 * Math.sin(phi) * Math.cos(theta),
      0.5 + 0.57 * 0.72 * Math.cos(phi),
      0.57 * Math.sin(phi) * Math.sin(theta)
    );
    spot.scale.y = 0.45;
    spot.castShadow = false;
    g.add(spot);
  }

  const door = makeDoor(0.18, 0.3, PALETTE.woodDark);
  door.position.set(0, 0, 0.27);
  g.add(door);

  const win = makeRoundWindow(0.06);
  win.position.set(0.24, 0.3, 0.12);
  win.rotation.y = Math.PI / 3;
  g.add(win);

  g.userData.icon = "🍜";
  return g;
}

// --- 🔨 Cottage workshop ---
function cottage(rng) {
  const g = new THREE.Group();

  g.add(mesh(new THREE.BoxGeometry(0.62, 0.46, 0.56), lambert(PALETTE.plaster), 0, 0.23, 0));

  const roof = makePrism(0.82, 0.34, 0.74, lambert(PALETTE.cottageRoof));
  roof.position.y = 0.45;
  g.add(roof);

  const chimney = mesh(new THREE.BoxGeometry(0.1, 0.26, 0.1), lambert(PALETTE.dirt), 0.18, 0.66, -0.14);
  g.add(chimney);
  g.userData.smokeAnchor = new THREE.Vector3(0.18, 0.82, -0.14);

  const door = makeDoor(0.17, 0.3, PALETTE.wood);
  door.position.set(-0.1, 0, 0.29);
  g.add(door);

  const win = makeSquareWindow(0.13);
  win.position.set(0.16, 0.26, 0.29);
  g.add(win);
  const win2 = makeSquareWindow(0.13);
  win2.position.set(0.32, 0.26, 0);
  win2.rotation.y = Math.PI / 2;
  g.add(win2);

  g.userData.icon = "🔨";
  return g;
}

// --- 💤 Stilted hut inn ---
function hut(rng) {
  const g = new THREE.Group();

  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.26, 6), lambert(PALETTE.woodDark), x, 0.13, z));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 14), lambert(PALETTE.wood), 0, 0.26, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.4, 14), lambert(PALETTE.plasterWarm), 0, 0.48, 0));

  // Shaggy thatch: a cone with its rim vertices jittered.
  const thatchGeom = new THREE.ConeGeometry(0.45, 0.42, 14, 1);
  const tp = thatchGeom.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    if (tp.getY(i) < 0) {
      const s = 1 + range(rng, -0.08, 0.1);
      tp.setX(i, tp.getX(i) * s);
      tp.setZ(i, tp.getZ(i) * s);
      tp.setY(i, tp.getY(i) + range(rng, -0.05, 0.02));
    }
  }
  thatchGeom.computeVertexNormals();
  const thatch = mesh(thatchGeom, lambert(PALETTE.thatch, { flatShading: true }), 0, 0.9, 0);
  g.add(thatch);

  const door = makeDoor(0.16, 0.26, PALETTE.woodDark);
  door.position.set(0, 0.285, 0.29);
  g.add(door);

  // Ladder up to the platform.
  const ladder = new THREE.Group();
  for (const x of [-0.05, 0.05]) {
    ladder.add(mesh(new THREE.BoxGeometry(0.02, 0.34, 0.02), lambert(PALETTE.wood), x, 0.17, 0));
  }
  for (let i = 0; i < 3; i++) {
    ladder.add(mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), lambert(PALETTE.wood), 0, 0.06 + i * 0.09, 0));
  }
  ladder.position.set(0, 0, 0.36);
  ladder.rotation.x = -0.22;
  g.add(ladder);

  g.userData.icon = "💤";
  return g;
}

// --- 🍓 Strawberry A-frame ---
function strawberryHouse(rng) {
  const g = new THREE.Group();

  const frame = makePrism(0.72, 0.82, 0.6, lambert(PALETTE.cottageRoof));
  g.add(frame);

  // Plaster gable face inset at the front.
  const face = makePrism(0.58, 0.66, 0.02, lambert(PALETTE.plaster));
  face.position.set(0, 0, 0.3);
  g.add(face);

  const door = makeDoor(0.16, 0.28, PALETTE.wood);
  door.position.set(0, 0, 0.32);
  g.add(door);

  // Strawberry sign above the door, matching the sketch's marker.
  const berry = mesh(new THREE.SphereGeometry(0.06, 10, 8), lambert(PALETTE.berry), 0, 0.42, 0.33);
  berry.scale.y = 1.15;
  g.add(berry);
  const leaves = mesh(new THREE.ConeGeometry(0.05, 0.05, 6), lambert(PALETTE.leafDark), 0, 0.49, 0.33);
  leaves.rotation.x = 0.15;
  g.add(leaves);

  const win = makeRoundWindow(0.055);
  win.position.set(0, 0.55, 0.28);
  g.add(win);

  g.userData.icon = "🍓";
  return g;
}

// --- 🍇 Vineyard tent ---
function tentTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const stripes = 10;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? PALETTE.tentB : PALETTE.tentA;
    ctx.fillRect((i * canvas.width) / stripes, 0, canvas.width / stripes + 1, canvas.height);
  }
  // Door slit at the front-center of the wrap.
  ctx.fillStyle = "#5a4632";
  ctx.beginPath();
  ctx.moveTo(118, 128);
  ctx.lineTo(138, 128);
  ctx.lineTo(128, 62);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function tent(rng) {
  const g = new THREE.Group();

  const cone = mesh(
    new THREE.ConeGeometry(0.4, 0.78, 24, 1, true),
    new THREE.MeshLambertMaterial({ map: tentTexture() }),
    0, 0.39, 0
  );
  cone.rotation.y = Math.PI / 2; // seam/door faces +z
  g.add(cone);

  g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), lambert(PALETTE.woodDark), 0, 0.84, 0));
  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0);
  flagShape.lineTo(0.14, 0.045);
  flagShape.lineTo(0, 0.09);
  flagShape.closePath();
  const flag = new THREE.Mesh(
    new THREE.ShapeGeometry(flagShape),
    lambert(PALETTE.flag, { side: THREE.DoubleSide })
  );
  flag.position.set(0.01, 0.85, 0);
  g.add(flag);

  g.userData.icon = "🍇";
  return g;
}

export const BUILDERS = { mushroom, cottage, hut, strawberryHouse, tent };
export const BUILDING_KINDS = Object.keys(BUILDERS);
