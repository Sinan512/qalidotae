/* ==========================================================================
   three-scene.js
   One WebGL renderer, one RAF loop, two GLB models (thobe + box).

   Everything geometric is derived from the models' real bounding boxes, so the
   framing, the fold and the slide into the box stay correct on any screen and
   with any GLB scale. GSAP only ever tweens the plain numbers in `state`; the
   render loop reads them each frame, so scroll scrubbing never fights the loop.
   ========================================================================== */

// Bare specifiers resolved by the import map in views/layout.hbs
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const DRESS_URL = "/thobDress.glb";
const FOLD_URL = "/foldDress.glb";
const BOX_URL = "/logoBox.glb";

// World height of the hanging thobe. Kept deliberately small so the whole
// garment fits inside a portrait phone viewport with breathing room.
const DRESS_HEIGHT = 2.15;
// The folded piece is measured against the thobe's own width, and the box is
// then measured against the folded piece — nothing here is a guessed number.
const BOX_WIDTH_RATIO = 0.62; // box width vs. hanging thobe width
const BOX_FILL = 0.7; // folded piece occupies this much of the box mouth

/** Fit a loaded model to a target height and centre it on its own origin. */
function normalize(object3D, targetHeight) {
  return fitModel(object3D, (size) => targetHeight / (size.y || 1));
}

/** Fit a loaded model to a target width and centre it on its own origin. */
function normalizeWidth(object3D, targetWidth) {
  return fitModel(object3D, (size) => targetWidth / (size.x || 1));
}

/** Fit a loaded model so its LARGEST dimension matches a target size. */
function normalizeMax(object3D, targetSize) {
  return fitModel(object3D, (size) => targetSize / (Math.max(size.x, size.y, size.z) || 1));
}

function fitModel(object3D, factor) {
  const bounds = new THREE.Box3().setFromObject(object3D);
  const size = new THREE.Vector3();
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

/**
 * Make every material on a model independently fade-able.
 * GLB materials are often shared between meshes, so they are cloned first.
 */
function makeFadeable(root) {
  const materials = [];
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const list = Array.isArray(child.material) ? child.material : [child.material];
    child.material = Array.isArray(child.material)
      ? list.map((m) => m.clone())
      : list[0].clone();
    const cloned = Array.isArray(child.material) ? child.material : [child.material];
    cloned.forEach((m) => {
      m.transparent = true;
      m.depthWrite = true;
      materials.push(m);
    });
  });
  return (opacity) => {
    materials.forEach((m) => {
      m.opacity = opacity;
      m.depthWrite = opacity > 0.85;
    });
  };
}


/** Best-effort lid detection so the box can open convincingly. */
function findLid(root) {
  let byName = null;
  let highest = null;
  let highestY = -Infinity;

  root.traverse((child) => {
    if (!child.isMesh) return;
    const name = (child.name || "").toLowerCase();
    if (!byName && /lid|cover|top|cap|flap/.test(name)) byName = child;

    const b = new THREE.Box3().setFromObject(child);
    if (b.max.y > highestY) {
      highestY = b.max.y;
      highest = child;
    }
  });

  return byName || highest;
}

/**
 * Re-parent the lid onto a hinge pivot at its rear-bottom edge.
 * Bounds are converted into the lid's PARENT space (the previous version mixed
 * world bounds with local coordinates, which made the lid swing off-axis).
 */
function buildLidPivot(lidMesh) {
  if (!lidMesh || !lidMesh.parent) return null;

  const parent = lidMesh.parent;
  parent.updateMatrixWorld(true);

  const world = new THREE.Box3().setFromObject(lidMesh);
  const min = parent.worldToLocal(world.min.clone());
  const max = parent.worldToLocal(world.max.clone());

  const hinge = new THREE.Vector3(
    (min.x + max.x) / 2,
    Math.min(min.y, max.y),
    Math.min(min.z, max.z) // rear edge
  );

  const pivot = new THREE.Group();
  pivot.position.copy(hinge);
  parent.add(pivot);

  lidMesh.position.sub(hinge);
  pivot.add(lidMesh);
  return pivot;
}

export async function createStage({ canvas, viewport, onProgress }) {
  const mqPhone = window.matchMedia("(max-width: 700px)");
  const mqTablet = window.matchMedia("(max-width: 1024px)");
  let isPhone = mqPhone.matches;
  let isTablet = mqTablet.matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isPhone, // antialiasing is the first thing to drop on phones
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isPhone ? 1.6 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

  // Soft studio lighting — no harsh speculars, keeps the white theme calm.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe9e6, 1.05));
  const key = new THREE.DirectionalLight(0xffffff, 1.45);
  key.position.set(2.6, 3.4, 4.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfeef0, 0.7);
  rim.position.set(-3, 1.5, -3);
  scene.add(rim);

  // ---------------------------------------------------------------- loading
  const loader = new GLTFLoader();
  const progress = { dress: 0, fold: 0, box: 0 };
  const report = () =>
    onProgress && onProgress((progress.dress + progress.fold + progress.box) / 3);

  const load = (url, name) =>
    new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          progress[name] = 1;
          report();
          resolve(gltf.scene);
        },
        (evt) => {
          if (evt.total) {
            progress[name] = evt.loaded / evt.total;
            report();
          }
        },
        reject
      );
    });

  const [dressRaw, foldRaw, boxRaw] = await Promise.all([
    load(DRESS_URL, "dress"),
    load(FOLD_URL, "fold"),
    load(BOX_URL, "box"),
  ]);

  // 1. the hanging thobe sets the scale of the whole scene
  const dress = normalize(dressRaw, DRESS_HEIGHT);
  // 2. the box is measured against the thobe's width, so both read at the
  //    same scale as the gold trim on the garment
  const box = normalizeWidth(boxRaw, dress.size.x * BOX_WIDTH_RATIO);
  // 3. the folded piece is fitted to the box mouth on its LARGEST dimension,
  //    so it can never poke out of the box whatever shape the GLB has
  const folded = normalizeMax(foldRaw, box.size.x * BOX_FILL);

  const dressGroup = dress.wrapper;
  const foldGroup = folded.wrapper;
  const boxGroup = box.wrapper;

  const setDressOpacity = makeFadeable(dressRaw);
  const setFoldOpacity = makeFadeable(foldRaw);

  foldGroup.visible = false;
  boxGroup.visible = false;
  scene.add(dressGroup, foldGroup, boxGroup);

  const lidPivot = buildLidPivot(findLid(boxRaw));

  /* ------------------------------------------------------------ geometry ---
     Every landmark below comes from the measured models, so the folded piece
     always meets the box mouth instead of a guessed offset.                */
  const BOX_Y = -DRESS_HEIGHT * 0.3; // where the box rests
  const MOUTH_Y = BOX_Y + box.size.y * 0.5; // top rim of the box
  const INSIDE_Y = BOX_Y + box.size.y * 0.05; // resting height inside the box
  const RISE_FROM = -(DRESS_HEIGHT * 0.5 + 1.6); // fully below frame at reveal 0


  // ------------------------------------------------------------------ state
  const state = {
    reveal: 0, // dress rises from below
    rotate: 0, // radians, showcase rotation
    fold: 0, // 0..1 cloth fold
    boxIn: 0, // box entrance
    lid: 0, // lid open amount
    slide: 0, // folded piece sliding into the box
    close: 0, // lid closing
    zoom: 0, // camera dolly toward the piece
    pack: 0, // reframe from thobe to box
    floatAmp: isPhone ? 0.04 : 0.075,
  };

  // --------------------------------------------------------------- framing
  // Distance that keeps the tallest/widest subject inside the frustum.
  let baseZ = 7;
  function frame() {
    const w = Math.max(1, viewport.clientWidth);
    const h = Math.max(1, viewport.clientHeight);
    const aspect = w / h;

    renderer.setSize(w, h, false);
    camera.aspect = aspect;

    const vFov = (camera.fov * Math.PI) / 180;
    // Copy sits beside the piece on desktop/tablet and below it on phones, so
    // the safe area differs per breakpoint. Phones get the largest margin:
    // the canvas is nudged up and the caption sits underneath the garment.
    const margin = isPhone ? 2.1 : isTablet ? 1.55 : 1.62;

    const needH = (DRESS_HEIGHT * margin * 0.5) / Math.tan(vFov / 2);
    const needW = (dress.size.x * margin * 0.5) / (Math.tan(vFov / 2) * aspect);
    baseZ = Math.max(needH, needW, 4.2);
    camera.updateProjectionMatrix();
  }

  function readBreakpoints() {
    isPhone = mqPhone.matches;
    isTablet = mqTablet.matches;
    state.floatAmp = isPhone ? 0.04 : 0.075;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isPhone ? 1.6 : 2));
  }

  readBreakpoints();
  frame();

  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      readBreakpoints();
      frame();
    }, 120);
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  // --------------------------------------------------------------- rendering
  const clock = new THREE.Clock();
  let running = true;

  /* Pause the loop while the canvas is off-screen.
     A rect test is used instead of an IntersectionObserver because once
     ScrollTrigger pins the viewport the observer stops reporting intersections
     and the renderer would silently stay parked (blank canvas). */
  function onScreen() {
    const r = viewport.getBoundingClientRect();
    return r.bottom > -120 && r.top < window.innerHeight + 120 && r.width > 0;
  }

  const tmp = new THREE.Vector3();

  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    if (!onScreen()) return;


    const t = clock.getElapsedTime();

    // Gentle suspended float — damped out once the piece starts folding.
    const settle = 1 - Math.min(1, state.fold + state.slide);
    const float = Math.sin(t * 0.75) * state.floatAmp * settle;
    const sway = Math.sin(t * 0.45) * 0.035 * settle;

    /* ------------------------------------------- thobe -> folded piece ----
       The hanging thobe cross-dissolves into foldDress.glb over the fold beat:
       the hanging model shrinks a touch as it fades, the folded model grows
       into place, so the change of geometry stays unnoticeable. The folded
       piece then slides into the box mouth.                                */
    const f = state.fold;
    const restY = RISE_FROM + (0 - RISE_FROM) * state.reveal; // rise into centre
    // After folding it hovers just above the box mouth, then slides in.
    const hoverY = MOUTH_Y + box.size.y * 0.55;
    const pathY = restY + (hoverY - restY) * f + (INSIDE_Y - hoverY) * state.slide;
    const pathX = sway * 0.6 * (1 - f);

    // 0 .. 0.35 -> thobe fades out;  0.25 .. 0.7 -> folded piece fades in.
    // The handover happens early so the large translucent thobe is never
    // on screen at the same time as the (much smaller) box.
    const outA = 1 - Math.min(1, f / 0.35);
    const inA = Math.min(1, Math.max(0, (f - 0.25) / 0.45));

    dressGroup.position.set(pathX, pathY + float, 0);
    dressGroup.scale.setScalar(1 - 0.12 * f);
    dressGroup.rotation.y = state.rotate * (1 - f) + sway * 0.25 * (1 - f);
    dressGroup.rotation.x = 0;
    dressGroup.rotation.z = 0;
    dressGroup.visible = state.reveal > 0.001 && outA > 0.002;
    if (dressGroup.visible) setDressOpacity(outA);

    foldGroup.position.set(pathX * 0.4, pathY + float * (1 - state.slide), 0);
    foldGroup.scale.setScalar(0.86 + 0.14 * inA);
    foldGroup.rotation.y = -0.42 + state.boxIn * 0.42 + sway * 0.12;
    // Laid flat as it settles into the box, then hidden under the closing lid
    // so it can never be seen poking through the packaging.
    foldGroup.rotation.x = -0.05 * (1 - state.slide) - 1.45 * state.slide;
    const foldA = inA * (1 - Math.min(1, state.close * 2.5));
    foldGroup.visible = foldA > 0.002;
    if (foldGroup.visible) setFoldOpacity(foldA);


    /* ------------------------------------------------------- the box ----- */
    boxGroup.visible = state.boxIn > 0.001;
    boxGroup.position.y = BOX_Y - (1 - state.boxIn) * 0.7;
    boxGroup.position.x = 0;
    boxGroup.scale.setScalar(0.86 + state.boxIn * 0.14);
    const open = Math.max(0, state.lid - state.close);
    boxGroup.rotation.y = -0.42 + state.boxIn * 0.42 + sway * 0.12;
    if (lidPivot) {
      lidPivot.rotation.x = -open * 1.9;
      boxGroup.rotation.x = 0;
    } else {
      // No identifiable lid: tilt the whole box open instead of doing nothing.
      boxGroup.rotation.x = -open * 0.5;
    }

    /* ------------------------------------------------------- camera ------ */
    // Dolly in for the showcase, then pull back slightly to hold thobe + box.
    // Phones get a gentler dolly and almost no tilt, so the garment stays
    // fully inside a portrait frame.
    const tilt = isPhone ? 0.35 : 1;
    // The box + folded piece are far smaller than the hanging thobe, so the
    // camera moves closer during the packaging beat instead of pulling back.
    const packPull = 1 - 0.62 * state.pack;
    camera.position.z = baseZ * (1 - (isPhone ? 0.06 : 0.14) * state.zoom) * packPull;
    camera.position.y = 0.12 * tilt * state.zoom + 0.05 * state.pack;
    camera.lookAt(0, -0.15 * tilt * state.zoom + (BOX_Y + 0.25) * state.pack, 0);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);

  return {
    state,
    get isPhone() {
      return isPhone;
    },
    get isTablet() {
      return isTablet;
    },
    refresh: frame,
    dispose() {
      running = false;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      renderer.dispose();
    },
  };
}
