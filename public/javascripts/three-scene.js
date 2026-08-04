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
const BOX_URL = "/logoBox.glb";

const DRESS_HEIGHT = 3.1; // world units — the whole scene is scaled around this
const BOX_HEIGHT = 1.25;

/** Fit a loaded model to a target height and centre it on its own origin. */
function normalize(object3D, targetHeight) {
  const bounds = new THREE.Box3().setFromObject(object3D);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  const k = targetHeight / (size.y || 1);
  object3D.scale.setScalar(k);
  object3D.position.set(-center.x * k, -center.y * k, -center.z * k);

  const wrapper = new THREE.Group();
  wrapper.add(object3D);
  return { wrapper, size: size.multiplyScalar(k) };
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
  const progress = { dress: 0, box: 0 };
  const report = () => onProgress && onProgress((progress.dress + progress.box) / 2);

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

  const [dressRaw, boxRaw] = await Promise.all([load(DRESS_URL, "dress"), load(BOX_URL, "box")]);

  const dress = normalize(dressRaw, DRESS_HEIGHT);
  const box = normalize(boxRaw, BOX_HEIGHT);

  const dressGroup = dress.wrapper;
  const boxGroup = box.wrapper;
  boxGroup.visible = false;
  scene.add(dressGroup, boxGroup);

  const lidPivot = buildLidPivot(findLid(boxRaw));

  /* ------------------------------------------------------------ geometry ---
     Every landmark below comes from the measured models, so the folded piece
     always meets the box mouth instead of a guessed offset.                */
  const BOX_Y = -DRESS_HEIGHT * 0.34; // where the box rests
  const MOUTH_Y = BOX_Y + box.size.y * 0.5; // top rim of the box
  const INSIDE_Y = BOX_Y + box.size.y * 0.12; // resting height inside the box
  const RISE_FROM = -(DRESS_HEIGHT * 0.5 + 1.6); // fully below frame at reveal 0

  // Folded footprint: shrink the piece until it fits the box interior.
  const fitK = Math.min(1, (box.size.x * 0.74) / (dress.size.x || 1));
  const SLAB = { x: fitK, y: fitK * 0.17, z: fitK * 0.9 };

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
    // the safe area differs per breakpoint.
    const margin = isPhone ? 1.28 : isTablet ? 1.5 : 1.62;
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

    /* ---------------------------------------------------- the thobe ------ */
    const f = state.fold;
    const restY = RISE_FROM + (0 - RISE_FROM) * state.reveal; // rise into centre
    // After folding it hovers just above the box mouth, then slides in.
    const hoverY = MOUTH_Y + box.size.y * 0.55;
    const foldedY = restY + (hoverY - restY) * f;
    dressGroup.position.y = foldedY + (INSIDE_Y - hoverY) * state.slide + float;
    dressGroup.position.x = sway * 0.6 * (1 - f);
    dressGroup.position.z = 0;

    // Cloth-like fold: compress vertically while the sleeves fold inward.
    tmp.set(1 + (SLAB.x - 1) * f, 1 + (SLAB.y - 1) * f, 1 + (SLAB.z - 1) * f);
    dressGroup.scale.copy(tmp);
    dressGroup.rotation.y = state.rotate * (1 - f) + sway * 0.25 * (1 - f);
    dressGroup.rotation.x = -f * 0.16; // slight settle tilt, not a squash
    dressGroup.rotation.z = f * 0.03;
    dressGroup.visible = state.reveal > 0.001;

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
    camera.position.z = baseZ * (1 - 0.14 * state.zoom + 0.1 * state.pack);
    camera.position.y = 0.12 * state.zoom + 0.05 * state.pack;
    camera.lookAt(0, -0.15 * state.zoom + (BOX_Y + 0.25) * state.pack, 0);

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
