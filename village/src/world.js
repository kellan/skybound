// ABOUTME: terrain heightfield, branching river, and island geometry for the village
// ABOUTME: owns heightAt(x,z) — the single source of truth all placement code samples

import * as THREE from "../vendor/three.module.js";
import { mulberry32, range } from "./rng.js";
import { PALETTE } from "./palette.js";

export const ISLAND_RADIUS = 7;
export const WATER_Y = -0.145;
export const RIVER_HALF_WIDTH = 0.5;
const RIVER_DEPTH = 0.34;
const SKIRT_BOTTOM = -0.85;
const BULGE_HEIGHT = 0.2;
const BULGE_FALLOFF = 0.45;

function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

// Sample a Catmull-Rom curve in the XZ plane down to a flat polyline
// of {x, z} points, used for distance queries and lily-pad placement.
function sampleCurve(controlPoints, samples) {
  const curve = new THREE.CatmullRomCurve3(
    controlPoints.map((p) => new THREE.Vector3(p.x, 0, p.z)),
    false,
    "catmullrom",
    0.5
  );
  return curve.getPoints(samples).map((v) => ({ x: v.x, z: v.z }));
}

function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x, az = pts[i].z;
    const bx = pts[i + 1].x, bz = pts[i + 1].z;
    const dx = bx - ax, dz = bz - az;
    const lenSq = dx * dx + dz * dz || 1;
    let t = ((x - ax) * dx + (z - az) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t - x;
    const pz = az + dz * t - z;
    const d = px * px + pz * pz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export class World {
  constructor(seed, colors = PALETTE, terrain = {}) {
    this.seed = seed;
    this.colors = colors; // PALETTE-shaped; themes override terrain/water keys
    this.hillAmp = terrain.hillAmp ?? 1; // relief multiplier (layer character)
    const rng = mulberry32(seed * 7919 + 13);

    // Rolling-hill noise phases, fixed per seed.
    this.phases = [0, 1, 2, 3, 4, 5].map(() => rng() * Math.PI * 2);

    // --- Branching river: a main channel across the island plus a fork,
    // matching the sketch's branching blue shape. Both are stored as flat
    // polylines; the terrain carves itself around them.
    const a0 = rng() * Math.PI * 2;
    const a1 = a0 + Math.PI + range(rng, -0.5, 0.5);
    const rimA = { x: Math.cos(a0) * ISLAND_RADIUS * 1.25, z: Math.sin(a0) * ISLAND_RADIUS * 1.25 };
    const rimB = { x: Math.cos(a1) * ISLAND_RADIUS * 1.25, z: Math.sin(a1) * ISLAND_RADIUS * 1.25 };
    const perp = { x: -(rimB.z - rimA.z), z: rimB.x - rimA.x };
    const perpLen = Math.hypot(perp.x, perp.z) || 1;
    perp.x /= perpLen;
    perp.z /= perpLen;
    const bend1 = range(rng, -2.2, 2.2);
    const bend2 = range(rng, -2.2, 2.2);
    const mid1 = {
      x: rimA.x * 0.62 + rimB.x * 0.38 + perp.x * bend1,
      z: rimA.z * 0.62 + rimB.z * 0.38 + perp.z * bend1,
    };
    const mid2 = {
      x: rimA.x * 0.32 + rimB.x * 0.68 + perp.x * bend2,
      z: rimA.z * 0.32 + rimB.z * 0.68 + perp.z * bend2,
    };
    this.riverMain = sampleCurve([rimA, mid1, mid2, rimB], 90);

    // Fork: leaves the main channel near its middle, exits at the rim
    // roughly perpendicular to the main flow.
    const forkFrom = this.riverMain[Math.floor(this.riverMain.length * 0.48)];
    const side = rng() < 0.5 ? 1 : -1;
    const aFork = Math.atan2(perp.z * side, perp.x * side) + range(rng, -0.5, 0.5);
    const rimC = { x: Math.cos(aFork) * ISLAND_RADIUS * 1.25, z: Math.sin(aFork) * ISLAND_RADIUS * 1.25 };
    const forkMid = {
      x: (forkFrom.x + rimC.x) / 2 + range(rng, -1, 1),
      z: (forkFrom.z + rimC.z) / 2 + range(rng, -1, 1),
    };
    this.riverFork = sampleCurve([forkFrom, forkMid, rimC], 60);

    this.buildingCoords = []; // [{x, z}] — set by the village, drives bulges

    this._buildTerrain();
    this._buildWater();
    this._buildBase();
  }

  distToRiver(x, z) {
    return Math.min(
      distToPolyline(x, z, this.riverMain),
      distToPolyline(x, z, this.riverFork)
    );
  }

  // Gentle rolling hills, in [-1, 1]-ish.
  _hills(x, z) {
    const p = this.phases;
    return (
      Math.sin(x * 0.52 + p[0]) * Math.cos(z * 0.47 + p[1]) * 0.5 +
      Math.sin((x + z) * 0.33 + p[2]) * 0.3 +
      Math.sin(x * 1.21 + p[3]) * Math.sin(z * 1.09 + p[4]) * 0.2
    );
  }

  // Height without building bulges: hills faded toward the rim, plus the
  // river carve. Precomputed per terrain vertex; also callable analytically.
  staticHeightAt(x, z) {
    const r = Math.hypot(x, z);
    const fade = smoothstep((ISLAND_RADIUS - r) / 1.4);
    const base = (0.1 * this.hillAmp * this._hills(x, z) + 0.06) * fade;
    const d = this.distToRiver(x, z);
    const carve = -RIVER_DEPTH * Math.exp(-(d * d) / (RIVER_HALF_WIDTH * RIVER_HALF_WIDTH));
    return base + carve;
  }

  bulgeAt(x, z) {
    let h = 0;
    for (const b of this.buildingCoords) {
      const dx = x - b.x;
      const dz = z - b.z;
      h += BULGE_HEIGHT * Math.exp(-(dx * dx + dz * dz) / BULGE_FALLOFF);
    }
    return h;
  }

  heightAt(x, z) {
    return this.staticHeightAt(x, z) + this.bulgeAt(x, z);
  }

  // --- Terrain: a square grid whose outer vertices are clamped to the
  // island rim and pulled down, forming the diorama's dirt skirt in the
  // same mesh. Static heights are cached so drag only re-adds bulges.
  _buildTerrain() {
    const R = ISLAND_RADIUS;
    const size = R * 2.6;
    const segs = 130;
    const geom = new THREE.PlaneGeometry(size, size, segs, segs);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    const count = pos.count;
    this.staticHeights = new Float32Array(count);
    this.isWall = new Uint8Array(count);
    const colors = new Float32Array(count * 3);

    const grassLow = new THREE.Color(this.colors.grassLow);
    const grassHigh = new THREE.Color(this.colors.grassHigh);
    const sand = new THREE.Color(this.colors.sand);
    const dirt = new THREE.Color(this.colors.dirt);
    const dirtDeep = new THREE.Color(this.colors.dirtDeep);
    const c = new THREE.Color();

    const detail = mulberry32(this.seed * 131 + 7); // color speckle only

    for (let i = 0; i < count; i++) {
      let x = pos.getX(i);
      let z = pos.getZ(i);
      const r = Math.hypot(x, z);

      if (r > R) {
        // Skirt: clamp to the rim circle and descend to the base.
        const t = Math.min((r - R) / (R * 0.3), 1);
        x = (x / r) * R;
        z = (z / r) * R;
        pos.setX(i, x);
        pos.setZ(i, z);
        const rimY = this.staticHeightAt(x, z);
        const y = rimY + (SKIRT_BOTTOM - rimY) * t;
        pos.setY(i, y);
        this.staticHeights[i] = y;
        this.isWall[i] = 1;
        c.lerpColors(dirt, dirtDeep, smoothstep(t));
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
        continue;
      }

      const h = this.staticHeightAt(x, z);
      pos.setY(i, h);
      this.staticHeights[i] = h;

      const dRiver = this.distToRiver(x, z);
      if (dRiver < RIVER_HALF_WIDTH * 1.9) {
        // Sandy banks blending back into grass.
        const t = smoothstep((dRiver - RIVER_HALF_WIDTH * 0.7) / (RIVER_HALF_WIDTH * 1.2));
        c.lerpColors(sand, grassLow, t);
      } else {
        const t = smoothstep((h + 0.05) / 0.24) * 0.8 + detail() * 0.2;
        c.lerpColors(grassLow, grassHigh, t);
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();

    this.terrain = new THREE.Mesh(
      geom,
      new THREE.MeshLambertMaterial({ vertexColors: true })
    );
    this.terrain.receiveShadow = true;
  }

  // Re-apply building bulges on top of cached static heights.
  // Cheap enough to run every frame while dragging.
  updateBulges() {
    const pos = this.terrain.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (this.isWall[i]) continue;
      pos.setY(i, this.staticHeights[i] + this.bulgeAt(pos.getX(i), pos.getZ(i)));
    }
    pos.needsUpdate = true;
    this.terrain.geometry.computeVertexNormals();
  }

  _buildWater() {
    const geom = new THREE.CircleGeometry(ISLAND_RADIUS * 0.995, 64);
    geom.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(
      geom,
      new THREE.MeshLambertMaterial({
        color: this.colors.water,
        transparent: true,
        opacity: 0.88,
      })
    );
    this.water.position.y = WATER_Y;
  }

  // Flat disk closing the underside of the skirt.
  _buildBase() {
    const geom = new THREE.CircleGeometry(ISLAND_RADIUS, 64);
    geom.rotateX(Math.PI / 2);
    this.base = new THREE.Mesh(
      geom,
      new THREE.MeshLambertMaterial({ color: this.colors.dirtDeep })
    );
    this.base.position.y = SKIRT_BOTTOM;
  }

  addTo(scene) {
    scene.add(this.terrain, this.water, this.base);
  }

  dispose(scene) {
    for (const mesh of [this.terrain, this.water, this.base]) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}
