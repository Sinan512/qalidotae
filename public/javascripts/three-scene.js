/* ==========================================================================
   three-scene.js
   Main 3D stage: thobe rise → showcase → box opens (lid lifts up like a
   gift box) → folded dress placed inside → lid closes with logo facing.
   + Ambient background thobe canvases with color-tint cycling.
   ========================================================================== */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const DRESS_URL = "/thobDress.glb";
const FOLD_URL  = "/foldDress.glb";
const BOX_URL   = "/logoBox.glb";

const DRESS_HEIGHT    = 2.15;
const BOX_WIDTH_RATIO = 0.7;
const BOX_FILL        = 0.88;

const DRESS_FRONT_YAW = -Math.PI / 2;
const FOLD_FRONT_YAW  = -Math.PI / 2;
const BOX_FRONT_YAW   = 0;

// Tint colors that cycle on ambient thobe canvases
const TINT_COLORS = [
  new THREE.Color(0xc9a96e), // gold
  new THREE.Color(0xffffff), // white
  new THREE.Color(0x1a3a6e), // navy
  new THREE.Color(0x1a4a2e), // deep green
  new THREE.Color(0x8b2252), // deep rose
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth  = (v) => { const x = clamp01(v); return x * x * (3 - 2 * x); };

function normalize(object3D, targetHeight) {
  return fitModel(object3D, (size) => targetHeight / (size.y || 1));
}
function normalizeWidth(object3D, targetWidth) {
  return fitModel(object3D, (size) => targetWidth / (size.x || 1));
}
function fitModel(object3D, factor) {
  const bounds = new THREE.Box3().setFromObject(object3D);
  const size   = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  const k = factor(size);
  object3D.scale.setScalar(k);
  object3D.position.set(-center.x * k, -center.y * k, -center.z * k);
  const wrapper = new THREE.Group();
  wrapper.add(object3D);
  return { wrapper, size: size.multiplyScalar(k) };
}

function makeFadeable(root) {
  const materials = [];
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const list = Array.isArray(child.material) ? child.material : [child.material];
    child.material = Array.isArray(child.material)
      ? list.map((m) => m.clone())
      : list[0].clone();
    const cloned = Array.isArray(child.material) ? child.material : [child.material];
    cloned.forEach((m) => { m.transparent = true; m.depthWrite = true; materials.push(m); });
  });
  return (opacity) => {
    materials.forEach((m) => { m.opacity = opacity; m.depthWrite = opacity > 0.85; });
  };
}

/** Clone materials so we can tint each ambient thobe independently */
function makeColorable(root) {
  const materials = [];
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const list = Array.isArray(child.material) ? child.material : [child.material];
    child.material = Array.isArray(child.material)
      ? list.map((m) => m.clone())
      : list[0].clone();
    const cloned = Array.isArray(child.material) ? child.material : [child.material];
    cloned.forEach((m) => { m.transparent = true; materials.push(m); });
  });
  return (color, opacity = 0.18) => {
    materials.forEach((m) => {
      m.color.copy(color);
      m.opacity = opacity;
    });
  };
}

/* -------------- Lid detection & pivot (lift-up like gift box) -------------- */
function findLid(root) {
  let byName = null, highest = null, highestY = -Infinity;
  root.traverse((child) => {
    if (!child.isMesh) return;
    const name = (child.name || "").toLowerCase();
    if (!byName && /lid|cover|top|cap|flap/.test(name)) byName = child;
    const b = new THREE.Box3().setFromObject(child);
    if (b.max.y > highestY) { highestY = b.max.y; highest = child; }
  });
  return byName || highest;
}

/**
 * Build a hinge pivot at the CENTRE-BOTTOM of the lid so it lifts straight up.
 * For a gift box the lid lifts off the top — pivot at bottom-centre of lid,
 * rotating around X so the front of the lid rises away from camera.
 */
function buildLidPivot(lidMesh) {
  if (!lidMesh || !lidMesh.parent) return null;
  const parent = lidMesh.parent;
  parent.updateMatrixWorld(true);

  const world = new THREE.Box3().setFromObject(lidMesh);
  const min   = parent.worldToLocal(world.min.clone());
  const max   = parent.worldToLocal(world.max.clone());

  // Hinge sits at the bottom-centre of the lid (lift-up pivot)
  const hinge = new THREE.Vector3(
    (min.x + max.x) / 2,
    Math.min(min.y, max.y), // bottom of lid
    (min.z + max.z) / 2    // centre depth
  );

  const pivot = new THREE.Group();
  pivot.position.copy(hinge);
  parent.add(pivot);
  lidMesh.position.sub(hinge);
  pivot.add(lidMesh);
  return pivot;
}

/* ============================================================
   AMBIENT THOBE CANVASES
   6 small WebGL canvases scattered across the page, each with
   a slowly rotating, colour-cycling thobe.
   ============================================================ */
function createAmbientThobes(gltfScene) {
  const containers = document.querySelectorAll(".thobe-strip__canvas");
  if (!containers.length) return [];

  const instances = [];

  containers.forEach((canvas, idx) => {
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;

      const w = canvas.clientWidth  || 140;
      const h = canvas.clientHeight || 200;
      renderer.setSize(w, h, false);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
      camera.position.z = 5.5;

      scene.add(new THREE.HemisphereLight(0xffffff, 0x8899cc, 1.2));
      const dl = new THREE.DirectionalLight(0xffeedd, 1.4);
      dl.position.set(2, 3, 4);
      scene.add(dl);

      // Clone the scene so each canvas gets independent materials
      const clone = gltfScene.clone(true);
      const { wrapper } = normalize(clone, 2.0);
      wrapper.rotation.y = DRESS_FRONT_YAW;

      const setColor = makeColorable(clone);
      scene.add(wrapper);

      // Stagger phase and rotation speed per instance
      const phase  = (idx / containers.length) * Math.PI * 2;
      const speed  = 0.28 + idx * 0.07;
      const colorIdx = idx % TINT_COLORS.length;

      let running = true;
      const clock = new THREE.Clock();

      const tick = () => {
        if (!running) return;
        requestAnimationFrame(tick);
        const t = clock.getElapsedTime();

        // Gentle left-right sway + slow spin
        wrapper.rotation.y = DRESS_FRONT_YAW + Math.sin(t * speed + phase) * 0.55;
        wrapper.position.y = Math.sin(t * 0.6 + phase) * 0.08;

        // Color cycle: blend between two neighbouring tints
        const cycleSpeed = 0.18;
        const cycleT  = (t * cycleSpeed + idx * 0.4) % TINT_COLORS.length;
        const ci      = Math.floor(cycleT) % TINT_COLORS.length;
        const cn      = (ci + 1) % TINT_COLORS.length;
        const blend   = cycleT - Math.floor(cycleT);
        const mixed   = TINT_COLORS[ci].clone().lerp(TINT_COLORS[cn], blend);
        setColor(mixed, 0.22);

        renderer.render(scene, camera);
      };
      requestAnimationFrame(tick);

      instances.push({ renderer, running: () => running, stop: () => { running = false; } });
    } catch (e) {
      // silently skip if WebGL context limit reached
    }
  });

  return instances;
}

/* ============================================================
   MAIN STAGE
   ============================================================ */
export async function createStage({ canvas, viewport, onProgress }) {
  const mqPhone  = window.matchMedia("(max-width: 700px)");
  const mqTablet = window.matchMedia("(max-width: 1024px)");
  let isPhone  = mqPhone.matches;
  let isTablet = mqTablet.matches;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: !isPhone, alpha: true, powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isPhone ? 1.6 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

  // Warm golden-tinted studio lighting for the atelier atmosphere
  scene.add(new THREE.HemisphereLight(0xfff5e0, 0x0d1428, 1.1));
  const key = new THREE.DirectionalLight(0xffeedd, 1.5);
  key.position.set(2.6, 3.4, 4.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xaabbff, 0.6);
  rim.position.set(-3, 1.5, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xc9a96e, 0.35);
  fill.position.set(0, -2, 3);
  scene.add(fill);

  // ---------------------------------------------------------------- loading
  const loader = new GLTFLoader();
  const progress = { dress: 0, fold: 0, box: 0 };
  const report = () => onProgress && onProgress((progress.dress + progress.fold + progress.box) / 3);

  const load = (url, name) => new Promise((resolve, reject) => {
    loader.load(url,
      (gltf) => { progress[name] = 1; report(); resolve(gltf.scene); },
      (evt)  => { if (evt.total) { progress[name] = evt.loaded / evt.total; report(); } },
      reject
    );
  });

  const [dressRaw, foldRaw, boxRaw] = await Promise.all([
    load(DRESS_URL, "dress"),
    load(FOLD_URL,  "fold"),
    load(BOX_URL,   "box"),
  ]);

  // Spin up ambient thobe canvases using the thobe GLB
  createAmbientThobes(dressRaw.clone ? dressRaw.clone(true) : dressRaw);

  // Scale hierarchy: thobe sets base, box matches thobe width, fold fits box
  const dress  = normalize(dressRaw, DRESS_HEIGHT);
  const dressFrontWidth = dress.size.z;
  const box    = normalizeWidth(boxRaw, dressFrontWidth * BOX_WIDTH_RATIO);
  const folded = fitModel(foldRaw, (size) => Math.min(
    (box.size.x * BOX_FILL) / (size.z || 1),
    (box.size.z * BOX_FILL) / (size.y || 1)
  ));

  const dressGroup = dress.wrapper;
  const foldGroup  = folded.wrapper;
  const boxGroup   = box.wrapper;

  const setDressOpacity = makeFadeable(dressRaw);
  const setFoldOpacity  = makeFadeable(foldRaw);

  foldGroup.visible = false;
  boxGroup.visible  = false;
  scene.add(dressGroup, foldGroup, boxGroup);

  /* ---- Lid pivot (lift-up like a gift box) ---- */
  const lidMesh  = findLid(boxRaw);
  const lidPivot = buildLidPivot(lidMesh);

  // We need the natural "closed" Y position of the lid so we can animate it
  // upward. When open, the pivot rotates -π (180°) around X so the lid
  // travels straight up and over, clearing the opening fully.
  const LID_OPEN_ANGLE = -Math.PI; // rotate 180° upward over the back

  /* Box geometry landmarks */
  const BOX_Y    = -DRESS_HEIGHT * 0.3;
  const MOUTH_Y  = BOX_Y + box.size.y * 0.5;
  const INSIDE_Y = BOX_Y - box.size.y * 0.15; // folded dress rests just inside
  const RISE_FROM = -(DRESS_HEIGHT * 0.5 + 1.6);

  // ------------------------------------------------------------------ state
  const state = {
    reveal:   0,
    rotate:   0,
    fold:     0,
    boxIn:    0,
    lid:      0, // 0=closed, 1=fully open
    slide:    0,
    close:    0, // 0=open, 1=closed again
    zoom:     0,
    pack:     0,
    floatAmp: isPhone ? 0.04 : 0.075,
  };

  // --------------------------------------------------------------- framing
  let baseZ = 7;
  function frame() {
    const w = Math.max(1, viewport.clientWidth);
    const h = Math.max(1, viewport.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vFov   = (camera.fov * Math.PI) / 180;
    const margin = isPhone ? 2.1 : isTablet ? 1.55 : 1.62;
    const needH  = (DRESS_HEIGHT * margin * 0.5) / Math.tan(vFov / 2);
    const needW  = (dress.size.z * margin * 0.5) / (Math.tan(vFov / 2) * camera.aspect);
    baseZ = Math.max(needH, needW, 4.2);
    camera.updateProjectionMatrix();
  }

  function readBreakpoints() {
    isPhone  = mqPhone.matches;
    isTablet = mqTablet.matches;
    state.floatAmp = isPhone ? 0.04 : 0.075;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isPhone ? 1.6 : 2));
  }

  readBreakpoints();
  frame();

  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { readBreakpoints(); frame(); }, 120);
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  // --------------------------------------------------------------- render loop
  const clock = new THREE.Clock();
  let running = true;

  function onScreen() {
    const r = viewport.getBoundingClientRect();
    return r.bottom > -120 && r.top < window.innerHeight + 120 && r.width > 0;
  }

  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    if (!onScreen()) return;

    const t = clock.getElapsedTime();

    // Gentle float — damped once the piece starts folding
    const settle  = 1 - Math.min(1, state.fold + state.slide);
    const float   = Math.sin(t * 0.75) * state.floatAmp * settle;
    const sway    = Math.sin(t * 0.45) * 0.035 * settle;

    /* ---- thobe exit / folded piece enter ---- */
    const f      = state.fold;
    const restY  = RISE_FROM + (0 - RISE_FROM) * state.reveal;
    const BELOW_Y = RISE_FROM;

    const outT = smooth(f / 0.55);
    const inT  = smooth((f - 0.45) / 0.55);

    const hoverY = MOUTH_Y + folded.size.y * 0.62;
    const slideT = smooth(state.slide);

    const outA = 1 - clamp01((outT - 0.6) / 0.4);
    const inA  = clamp01(inT / 0.3);

    const dressY = restY + (BELOW_Y - restY) * outT;
    const sway1  = sway * (1 - outT);

    dressGroup.position.set(sway1 * 0.6, dressY + float * (1 - outT), 0);
    dressGroup.scale.setScalar(1 - 0.06 * outT);
    dressGroup.rotation.y = DRESS_FRONT_YAW + (state.rotate + sway * 0.25) * (1 - outT);
    dressGroup.rotation.x = 0;
    dressGroup.rotation.z = 0;
    dressGroup.visible = state.reveal > 0.001 && outA > 0.002;
    if (dressGroup.visible) setDressOpacity(outA);

    /* ---- folded piece: hover above open box → lower straight in ---- */
    // While sliding in, it descends straight down into the box mouth
    const foldY = BELOW_Y + (hoverY - BELOW_Y) * inT + (INSIDE_Y - hoverY) * slideT;
    // No Z shift needed — dress goes straight down into the open box
    foldGroup.position.set(0, foldY + float * (1 - slideT), 0);
    foldGroup.scale.setScalar(1);
    foldGroup.rotation.y = FOLD_FRONT_YAW + sway * 0.1 * (1 - slideT);
    // Lay flat as it settles into the box
    foldGroup.rotation.x = -(Math.PI / 2) * smooth(state.slide * 1.2);
    foldGroup.rotation.z = 0;

    const foldA = inA * (1 - clamp01((state.slide - 0.78) / 0.22));
    foldGroup.visible = foldA > 0.002;
    if (foldGroup.visible) setFoldOpacity(foldA);

    /* ---- box ---- */
    boxGroup.visible = state.boxIn > 0.001;
    boxGroup.position.y = BOX_Y - (1 - state.boxIn) * 0.7;
    boxGroup.position.x = 0;
    boxGroup.scale.setScalar(0.86 + state.boxIn * 0.14);
    boxGroup.rotation.y = BOX_FRONT_YAW;
    boxGroup.rotation.x = 0;
    boxGroup.rotation.z = 0;

    /* ---- Lid: lift straight UP (gift box style) ----
       state.lid   0→1 opens it (pivot rotates to LID_OPEN_ANGLE)
       state.close 0→1 closes it back to 0                           */
    if (lidPivot) {
      const openT  = smooth(state.lid);
      const closeT = smooth(state.close);
      // lid lifts to full open, then comes straight back down
      lidPivot.rotation.x = LID_OPEN_ANGLE * openT * (1 - closeT);
    }

    /* ---- camera ---- */
    const tilt     = isPhone ? 0.35 : 1;
    const packPull = 1 - 0.62 * state.pack;
    camera.position.z = baseZ * (1 - (isPhone ? 0.06 : 0.14) * state.zoom) * packPull;
    camera.position.y = 0.12 * tilt * state.zoom + 0.05 * state.pack;
    camera.lookAt(0, -0.15 * tilt * state.zoom + (BOX_Y + 0.25) * state.pack, 0);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);

  return {
    state,
    get isPhone()  { return isPhone; },
    get isTablet() { return isTablet; },
    refresh: frame,
    dispose() {
      running = false;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      renderer.dispose();
    },
  };
}
