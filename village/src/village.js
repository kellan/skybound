// ABOUTME: assembles a village on a World — building placement, growth,
// ABOUTME: scenery, bridge, lily pads — and handles live re-tethering on drag

import * as THREE from "../vendor/three.module.js";
import { mulberry32, range, shuffle } from "./rng.js";
import { World, ISLAND_RADIUS, WATER_Y, RIVER_HALF_WIDTH } from "./world.js";
import { BUILDERS, BUILDING_KINDS } from "./buildings.js";
import { buildGrowth, roundTree, pineTree, rock, lilyPad, buildBridge } from "./decor.js";

const BUILD_RADIUS = 4.6; // buildings stay inside this ring
const RIVER_MARGIN = 1.15; // buildings keep this far from the river center
const MIN_SPACING = 1.75;

export class Village {
  constructor(scene, seed, count) {
    this.scene = scene;
    this.seed = seed;
    this.world = new World(seed);
    this.world.addTo(scene);

    this.group = new THREE.Group(); // everything except terrain/water
    scene.add(this.group);
    this.buildings = [];
    this.smokeAnchors = [];

    const rng = mulberry32(seed);
    this._placeBuildings(rng, count);
    this._placeScenery(rng);
    this._placeLilyPads(rng);
    this._placeBridge();
  }

  // Rejection-sample positions on land, then assign kinds so every type
  // appears once before repeats (the sketch has one of each).
  _placeBuildings(rng, count) {
    const coords = [];
    let attempts = 0;
    while (coords.length < count && attempts < count * 400) {
      attempts++;
      const r = Math.sqrt(rng()) * BUILD_RADIUS;
      const theta = rng() * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      if (this.world.distToRiver(x, z) < RIVER_MARGIN) continue;
      if (coords.some((p) => Math.hypot(p.x - x, p.z - z) < MIN_SPACING)) continue;
      coords.push({ x, z });
    }

    const kinds = [];
    if (coords.length >= BUILDING_KINDS.length) {
      kinds.push(...BUILDING_KINDS);
      while (kinds.length < coords.length) {
        kinds.push(BUILDING_KINDS[Math.floor(rng() * BUILDING_KINDS.length)]);
      }
    } else {
      kinds.push(...shuffle(rng, [...BUILDING_KINDS]).slice(0, coords.length));
    }
    shuffle(rng, kinds);

    this.world.buildingCoords = coords;

    for (let i = 0; i < coords.length; i++) {
      const kind = kinds[i];
      const b = BUILDERS[kind](rng);
      b.userData.isBuilding = true;
      b.userData.kind = kind;
      b.userData.coord = coords[i];
      b.rotation.y = range(rng, -0.45, 0.45);

      // Growth is a child of the building so it re-tethers for free; each
      // item drops by the local bulge falloff so it hugs the mound.
      const drop = (lx, lz) => {
        const d2 = lx * lx + lz * lz;
        return -0.2 * (1 - Math.exp(-d2 / 0.45)) - 0.01;
      };
      const growth = buildGrowth(kind, rng, drop);
      b.add(growth);

      if (b.userData.smokeAnchor) {
        this.smokeAnchors.push({ building: b, local: b.userData.smokeAnchor });
      }

      this.group.add(b);
      this.buildings.push(b);
    }

    this.world.updateBulges();
    this._settleBuildings();
  }

  _settleBuildings() {
    for (const b of this.buildings) {
      const { x, z } = b.userData.coord;
      b.position.set(x, this.world.heightAt(x, z) - 0.015, z);
    }
  }

  _placeScenery(rng) {
    const occupied = (x, z, margin) =>
      this.buildings.some((b) => Math.hypot(b.userData.coord.x - x, b.userData.coord.z - z) < margin);

    const scatter = (n, rMin, rMax, riverMargin, buildMargin, make) => {
      let placed = 0;
      let attempts = 0;
      while (placed < n && attempts < n * 60) {
        attempts++;
        const r = range(rng, rMin, rMax);
        const theta = rng() * Math.PI * 2;
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;
        if (this.world.distToRiver(x, z) < riverMargin) continue;
        if (occupied(x, z, buildMargin)) continue;
        const item = make(rng);
        item.position.set(x, this.world.heightAt(x, z) - 0.02, z);
        item.rotation.y = rng() * Math.PI * 2;
        this.group.add(item);
        placed++;
      }
    };

    scatter(7, 4.4, 6.4, 0.9, 1.4, (r) => (r() < 0.55 ? roundTree(r) : pineTree(r)));
    scatter(3, 1.5, 4.4, 0.95, 1.5, (r) => (r() < 0.5 ? roundTree(r) : pineTree(r)));
    scatter(8, 1, 6.2, 0.85, 1.2, rock);
    // Loose meadow tufts between the homesteads.
    scatter(26, 0.5, 6.3, 0.8, 1.1, buildGrowthTuft);
  }

  _placeLilyPads(rng) {
    const line = this.world.riverMain;
    const spots = [0.3, 0.55, 0.72];
    spots.forEach((t, i) => {
      const p = line[Math.floor(line.length * t)];
      if (Math.hypot(p.x, p.z) > ISLAND_RADIUS - 0.8) return;
      const pad = lilyPad(rng, i === 1);
      pad.position.set(
        p.x + range(rng, -0.15, 0.15),
        WATER_Y + 0.012,
        p.z + range(rng, -0.15, 0.15)
      );
      pad.rotation.y = rng() * Math.PI * 2;
      this.group.add(pad);
    });
  }

  _placeBridge() {
    // Cross the main river near the center, on a straight stretch, clear of
    // buildings, with both ends landing on dry banks. Skip the bridge
    // entirely if no sample qualifies — better no bridge than a broken one.
    const line = this.world.riverMain;
    const span = RIVER_HALF_WIDTH * 2 + 1.2;
    let best = -Infinity;
    let chosen = null;

    for (let i = 4; i < line.length - 4; i++) {
      const p = line[i];
      const dCenter = Math.hypot(p.x, p.z);
      if (dCenter > 3.8) continue;

      const inDir = { x: p.x - line[i - 4].x, z: p.z - line[i - 4].z };
      const outDir = { x: line[i + 4].x - p.x, z: line[i + 4].z - p.z };
      const inLen = Math.hypot(inDir.x, inDir.z) || 1;
      const outLen = Math.hypot(outDir.x, outDir.z) || 1;
      const straightness = (inDir.x * outDir.x + inDir.z * outDir.z) / (inLen * outLen);
      if (straightness < 0.9) continue;

      const tangent = { x: line[i + 3].x - line[i - 3].x, z: line[i + 3].z - line[i - 3].z };
      const tLen = Math.hypot(tangent.x, tangent.z) || 1;
      const across = { x: -tangent.z / tLen, z: tangent.x / tLen };
      const endA = { x: p.x + (across.x * span) / 2, z: p.z + (across.z * span) / 2 };
      const endB = { x: p.x - (across.x * span) / 2, z: p.z - (across.z * span) / 2 };
      if (this.world.staticHeightAt(endA.x, endA.z) < -0.02) continue;
      if (this.world.staticHeightAt(endB.x, endB.z) < -0.02) continue;

      let dBuild = Infinity;
      for (const b of this.buildings) {
        dBuild = Math.min(dBuild, Math.hypot(b.userData.coord.x - p.x, b.userData.coord.z - p.z));
      }
      const score = Math.min(dBuild, 3) - dCenter * 0.15 + straightness * 1.5;
      if (score > best) {
        best = score;
        chosen = { p, across, endA, endB };
      }
    }
    if (!chosen) return;

    const endHeight = Math.max(
      this.world.staticHeightAt(chosen.endA.x, chosen.endA.z),
      this.world.staticHeightAt(chosen.endB.x, chosen.endB.z)
    );
    this.group.add(buildBridge(chosen.p, chosen.across, span, endHeight));
  }

  dispose() {
    this.world.dispose(this.scene);
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
  }
}

// Standalone meadow tuft (avoids importing decor internals here).
function buildGrowthTuft(rng) {
  const geom = new THREE.ConeGeometry(range(rng, 0.04, 0.08), range(rng, 0.08, 0.18), 5);
  const mat = new THREE.MeshLambertMaterial({
    color: rng() < 0.5 ? "#7ea45c" : "#a3c076",
    flatShading: true,
  });
  const m = new THREE.Mesh(geom, mat);
  m.position.y = 0.04;
  m.rotation.y = rng() * Math.PI;
  return m;
}
