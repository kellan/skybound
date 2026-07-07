// ABOUTME: embeddable 3D village diorama — wraps the tethered-village spike
// ABOUTME: (scene, lights, tap-to-select cards, icon bubbles, smoke) behind
// ABOUTME: createVillageView({root, seed, count}) with a dispose() lifecycle.
//
// Used by the game (landing on an island) and by village-lab.html. Everything
// is deterministic per seed; the caller owns the root element and when to
// create/dispose. ES module — load with dynamic import() so pages that must
// work without module support only pay for it when a village is opened.

import * as THREE from "./vendor/three.module.js";
import { OrbitControls } from "./vendor/OrbitControls.js";
import { PALETTE, UI } from "./src/palette.js";
import { Village } from "./src/village.js";
import { themeFor } from "./src/theme.js";

const KIND_NAMES = {
  mushroom: "Noodle House",
  cottage: "Workshop",
  hut: "The Inn",
  strawberryHouse: "Strawberry Cottage",
  tent: "Vineyard Tent",
};

const ICON_CHOICES = [
  "🍜", "🔨", "💤", "🍓", "🍇", "🐟",
  "🍞", "🧪", "📚", "⚔️", "🏹", "🎣",
  "🕯️", "🎵", "💰", "🛡️", "⭐", "🌙",
];

// Scoped styles for the DOM the view creates inside its root. Injected once
// per document so the game and the lab can't drift apart.
const STYLE_ID = "village-view-style";
const CSS = `
.vv-root { position: relative; overflow: hidden; }
.vv-mount { position: absolute; inset: 0; }
.vv-mount canvas { touch-action: none; display: block; }
.vv-labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.vv-label {
  position: absolute; left: 0; top: 0;
  pointer-events: auto; cursor: pointer;
  background: ${UI.paper};
  border: 1.5px solid ${UI.inkSoft};
  border-radius: 14px;
  padding: 4px 10px;
  font-size: 18px;
  box-shadow: 2px 3px 0 rgba(0,0,0,0.08);
}
.vv-label-icon { font-size: 18px; line-height: 1; }
.vv-label-tail {
  position: absolute; bottom: -6px; left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 10px; height: 10px;
  background: ${UI.paper};
  border-right: 1.5px solid ${UI.inkSoft};
  border-bottom: 1.5px solid ${UI.inkSoft};
}
.vv-picker {
  position: absolute; display: none;
  grid-template-columns: repeat(6, 1fr); gap: 2px; padding: 8px;
  background: ${UI.paper};
  border: 1.5px solid ${UI.inkSoft};
  border-radius: 12px;
  box-shadow: 3px 4px 0 rgba(0,0,0,0.12);
  z-index: 10;
}
.vv-picker button {
  border: none; background: transparent;
  font-size: 22px; padding: 4px; border-radius: 8px; cursor: pointer;
}
.vv-picker button:hover { background: rgba(107,90,58,0.15); }
.vv-card {
  position: absolute; display: none;
  min-width: 170px; padding: 12px 16px;
  background: ${UI.paper};
  border: 1.5px solid ${UI.inkSoft};
  border-radius: 12px;
  box-shadow: 3px 4px 0 rgba(0,0,0,0.12);
  z-index: 9; text-align: center;
  font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
}
.vv-card .vv-card-icon { font-size: 30px; line-height: 1.2; }
.vv-card .vv-card-name { font-size: 15px; font-weight: 700; color: ${UI.ink}; margin-top: 2px; }
.vv-card .vv-card-hint { font-size: 11px; font-style: italic; color: ${UI.inkSoft}; margin-top: 4px; line-height: 1.45; }
.vv-card { max-width: 240px; }
.vv-card .vv-card-action {
  display: none;
  margin: 8px auto 0;
  padding: 7px 16px;
  background: ${UI.ink};
  color: ${UI.paper};
  border: none;
  border-radius: 8px;
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 0.06em;
  cursor: pointer;
}
.vv-card .vv-card-action:active { transform: translateY(1px); }
`;

function ensureStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

/**
 * Mount a village diorama inside `root` (which should be sized by the
 * caller; the view fills it). `character` carries the island's identity —
 * { modifiers: [...], layer: 0|1|2 } — and themes terrain, scenery and
 * props (see src/theme.js). Returns a handle:
 *   regenerate(seed, count, character)  — rebuild the village in place
 *   setLabelsVisible(bool)              — toggle the floating icon bubbles
 *   dispose()                           — tear down GL context, DOM, listeners
 */
export function createVillageView({
  root, seed = 1, count = 6, character = {},
  cardHint = "game panel coming soon",
  // Game hooks: actionFor(kind) -> {label} | null puts a button on the
  // building card; onAction(kind, building) runs it and may return
  // {message} (or a string) to show on the card.
  actionFor = () => null,
  onAction = () => null,
}) {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  ensureStyles(doc);
  root.classList.add("vv-root");

  const mount = doc.createElement("div");
  mount.className = "vv-mount";
  const labelsContainer = doc.createElement("div");
  labelsContainer.className = "vv-labels";
  const picker = doc.createElement("div");
  picker.className = "vv-picker";
  const card = doc.createElement("div");
  card.className = "vv-card";
  card.innerHTML =
    '<div class="vv-card-icon"></div><div class="vv-card-name"></div>' +
    '<div class="vv-card-hint"></div><button class="vv-card-action"></button>';
  card.querySelector(".vv-card-hint").textContent = cardHint;
  const cardIcon = card.querySelector(".vv-card-icon");
  const cardName = card.querySelector(".vv-card-name");
  const cardHintEl = card.querySelector(".vv-card-hint");
  const cardActionBtn = card.querySelector(".vv-card-action");
  root.append(mount, labelsContainer, picker, card);

  cardActionBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!selected) return;
    const result = onAction(selected.userData.kind, selected);
    const message = typeof result === "string" ? result : result && result.message;
    if (message) {
      cardHintEl.textContent = message;
      // One shot per visit to the card; reselecting re-offers the action.
      cardActionBtn.style.display = "none";
      placeCard();
    }
  });

  // --- Renderer / scene / camera ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.sky, 18, 40);

  const w = () => Math.max(1, root.clientWidth);
  const h = () => Math.max(1, root.clientHeight);

  const camera = new THREE.PerspectiveCamera(36, w() / h(), 0.1, 100);
  // Pull back on narrow (portrait/phone) screens so the island fits the frame.
  const fit = Math.pow(Math.max(1, 1.2 / camera.aspect), 0.75);
  camera.position.set(8.2 * fit, 7.2 * fit, 10.2 * fit);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 2));
  renderer.setSize(w(), h());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4.5;
  controls.maxDistance = 24;
  controls.maxPolarAngle = Math.PI * 0.46;

  // --- Light rig: retuned per theme in regenerate (each altitude layer has
  // its own weather — see LAYER_LIGHT in src/theme.js) ---
  const hemi = new THREE.HemisphereLight(0xfff2d8, 0xb8a878, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffeecb, 1.9);
  sun.position.set(6, 10, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9;
  sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9;
  sun.shadow.camera.bottom = -9;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  function applyLight(light) {
    sun.color.set(light.sunColor);
    sun.intensity = light.sunIntensity;
    sun.position.set(...light.sunPosition);
    hemi.color.set(light.hemiSky);
    hemi.groundColor.set(light.hemiGround);
    hemi.intensity = light.hemiIntensity;
  }

  const state = { seed, count, character, showLabels: true, village: null };

  function regenerate(newSeed = state.seed, newCount = state.count, newCharacter = state.character) {
    state.seed = newSeed;
    state.count = newCount;
    state.character = newCharacter;
    const theme = themeFor(state.character, state.seed);
    state.skyColor = theme.colors.sky; // callers match their chrome to the weather
    scene.background = new THREE.Color(theme.colors.sky);
    // Fog distances scale with the same fit factor as the camera, so portrait
    // phones (camera pulled back ~2x) don't drown the diorama in fog.
    scene.fog = new THREE.Fog(theme.colors.sky, theme.light.fogNear * fit, theme.light.fogFar * fit);
    applyLight(theme.light);
    if (state.village) state.village.dispose();
    state.village = new Village(scene, state.seed, state.count, theme);
    syncLabelCount(0); // force label rebuild for new building set
    hidePicker();
    deselectBuilding();
  }

  // --- Chimney smoke: a small pool of puffs looping upward ---
  const smokeMat = new THREE.MeshLambertMaterial({
    color: PALETTE.smoke,
    transparent: true,
    opacity: 0.85,
  });
  const smokeGeom = new THREE.SphereGeometry(0.05, 8, 6);
  const PUFFS_PER_CHIMNEY = 3;
  const smokePool = [];
  for (let i = 0; i < 12; i++) {
    const puff = new THREE.Mesh(smokeGeom, smokeMat);
    puff.visible = false;
    scene.add(puff);
    smokePool.push(puff);
  }
  const anchorWorld = new THREE.Vector3();

  function updateSmoke(t) {
    const anchors = state.village ? state.village.smokeAnchors : [];
    let puffIdx = 0;
    for (let a = 0; a < anchors.length; a++) {
      const { building, local } = anchors[a];
      anchorWorld.copy(local);
      building.localToWorld(anchorWorld);
      for (let i = 0; i < PUFFS_PER_CHIMNEY && puffIdx < smokePool.length; i++, puffIdx++) {
        const puff = smokePool[puffIdx];
        const phase = ((t * 0.25 + i / PUFFS_PER_CHIMNEY + a * 0.37) % 1 + 1) % 1;
        puff.visible = true;
        puff.position.set(
          anchorWorld.x + Math.sin(t * 1.7 + i * 2.1) * 0.05 * phase,
          anchorWorld.y + phase * 0.55,
          anchorWorld.z + Math.cos(t * 1.3 + i * 1.7) * 0.05 * phase
        );
        const s = 0.5 + phase * 1.1;
        puff.scale.set(s, s, s);
      }
    }
    for (; puffIdx < smokePool.length; puffIdx++) smokePool[puffIdx].visible = false;
  }

  // --- Buildings as tap targets ---
  // Tapping a building selects it and opens its card — the stub the game UI
  // will grow into. A pointer that travels far is camera orbit, not a tap.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selected = null;

  function rootPoint(e) {
    const rect = root.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function setPointer(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
  }

  function pickBuilding() {
    if (!state.village) return null;
    const hits = raycaster.intersectObjects(state.village.buildings, true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj.parent && !obj.userData.isBuilding) obj = obj.parent;
    return obj.userData.isBuilding ? obj : null;
  }

  function placeOver(el, x, y, lift) {
    const rect = el.getBoundingClientRect();
    el.style.left = `${Math.min(Math.max(8, x - rect.width / 2), w() - rect.width - 8)}px`;
    el.style.top = `${Math.max(8, y - rect.height - lift)}px`;
  }

  let lastCardPos = null;
  function placeCard() {
    if (lastCardPos) placeOver(card, lastCardPos.x, lastCardPos.y, 18);
  }

  function selectBuilding(building, x, y) {
    deselectBuilding();
    selected = building;
    building.scale.setScalar(1.07);
    cardIcon.textContent = building.userData.icon;
    cardName.textContent = KIND_NAMES[building.userData.kind] || building.userData.kind;
    cardHintEl.textContent = cardHint;
    const action = actionFor(building.userData.kind);
    if (action) {
      cardActionBtn.textContent = action.label;
      cardActionBtn.style.display = "inline-block";
    } else {
      cardActionBtn.style.display = "none";
    }
    card.style.display = "block";
    lastCardPos = { x, y };
    placeCard();
  }

  function deselectBuilding() {
    if (selected) selected.scale.setScalar(1);
    selected = null;
    card.style.display = "none";
  }

  const tapStart = { x: 0, y: 0 };
  function onCanvasDown(e) {
    tapStart.x = e.clientX;
    tapStart.y = e.clientY;
  }
  function onCanvasUp(e) {
    if (Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 8) return; // orbit, not a tap
    setPointer(e);
    const hit = pickBuilding();
    const p = rootPoint(e);
    if (hit) selectBuilding(hit, p.x, p.y);
    else deselectBuilding();
  }
  function onCanvasMove(e) {
    if (e.buttons) return;
    setPointer(e);
    renderer.domElement.style.cursor = pickBuilding() ? "pointer" : "default";
  }
  renderer.domElement.addEventListener("pointerdown", onCanvasDown);
  renderer.domElement.addEventListener("pointerup", onCanvasUp);
  renderer.domElement.addEventListener("pointermove", onCanvasMove);

  // --- Speech-bubble labels (floating role icons) ---
  // Tapping a bubble opens a picker to reassign that building's icon —
  // handy for trying out different shop/role concepts.
  let pickerTarget = null; // building whose icon is being edited

  for (const emoji of ICON_CHOICES) {
    const btn = doc.createElement("button");
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      if (pickerTarget) pickerTarget.userData.icon = emoji;
      hidePicker();
    });
    picker.appendChild(btn);
  }

  function hidePicker() {
    picker.style.display = "none";
    pickerTarget = null;
  }

  function showPicker(building, x, y) {
    pickerTarget = building;
    picker.style.display = "grid";
    placeOver(picker, x, y, 14);
  }

  function onDocDown(e) {
    if (picker.style.display !== "none" && !picker.contains(e.target)) hidePicker();
  }
  doc.addEventListener("pointerdown", onDocDown);

  const labelEls = [];

  function syncLabelCount(n) {
    while (labelEls.length < n) {
      const el = doc.createElement("div");
      el.className = "vv-label";
      const icon = doc.createElement("span");
      icon.className = "vv-label-icon";
      const tail = doc.createElement("span");
      tail.className = "vv-label-tail";
      el.appendChild(icon);
      el.appendChild(tail);
      const entry = { el, icon };
      el.addEventListener("click", (e) => {
        const i = labelEls.indexOf(entry);
        const buildings = state.village ? state.village.buildings : [];
        if (i >= 0 && i < buildings.length) {
          const p = rootPoint(e);
          showPicker(buildings[i], p.x, p.y);
          e.stopPropagation();
        }
      });
      labelsContainer.appendChild(el);
      labelEls.push(entry);
    }
    while (labelEls.length > n) {
      labelsContainer.removeChild(labelEls.pop().el);
    }
  }

  const labelWorld = new THREE.Vector3();

  function updateLabels(t) {
    const buildings = state.village ? state.village.buildings : [];
    syncLabelCount(state.showLabels ? buildings.length : 0);
    if (!state.showLabels) return;
    const cw = renderer.domElement.clientWidth;
    const ch = renderer.domElement.clientHeight;
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const bob = Math.sin(t * 1.6 + i * 1.3) * 0.04;
      labelWorld.set(b.position.x, b.position.y + 1.15 + bob, b.position.z);
      labelWorld.project(camera);
      const entry = labelEls[i];
      if (labelWorld.z > 1) {
        entry.el.style.display = "none";
        continue;
      }
      entry.el.style.display = "";
      const sx = (labelWorld.x * 0.5 + 0.5) * cw;
      const sy = (-labelWorld.y * 0.5 + 0.5) * ch;
      entry.el.style.transform = `translate(-50%, -100%) translate(${sx}px, ${sy}px)`;
      entry.icon.textContent = b.userData.icon;
    }
  }

  function onResize() {
    camera.aspect = w() / h();
    camera.updateProjectionMatrix();
    renderer.setSize(w(), h());
  }
  let resizeObserver = null;
  if (typeof win.ResizeObserver === "function") {
    resizeObserver = new win.ResizeObserver(onResize);
    resizeObserver.observe(root);
  } else {
    win.addEventListener("resize", onResize);
  }

  // --- Go ---
  regenerate();

  const clock = new THREE.Clock();
  let rafId = null;
  let disposed = false;
  function loop() {
    if (disposed) return;
    const t = clock.getElapsedTime();
    updateLabels(t);
    updateSmoke(t);
    controls.update();
    renderer.render(scene, camera);
    rafId = win.requestAnimationFrame(loop);
  }
  loop();

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (rafId != null) win.cancelAnimationFrame(rafId);
    if (resizeObserver) resizeObserver.disconnect();
    else win.removeEventListener("resize", onResize);
    doc.removeEventListener("pointerdown", onDocDown);
    renderer.domElement.removeEventListener("pointerdown", onCanvasDown);
    renderer.domElement.removeEventListener("pointerup", onCanvasUp);
    renderer.domElement.removeEventListener("pointermove", onCanvasMove);
    if (state.village) state.village.dispose();
    smokeGeom.dispose();
    smokeMat.dispose();
    controls.dispose();
    renderer.dispose();
    mount.remove();
    labelsContainer.remove();
    picker.remove();
    card.remove();
    root.classList.remove("vv-root");
  }

  return {
    state,
    camera,
    renderer,
    controls,
    regenerate,
    get skyColor() { return state.skyColor; },
    setLabelsVisible(v) { state.showLabels = !!v; },
    dispose,
  };
}
