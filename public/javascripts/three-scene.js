/* ==========================================================================
   three-scene.js
   One WebGL renderer, one RAF loop, two GLB models (thobe + box).
   Exposes a plain numeric `state` object that GSAP timelines tween; the render
   loop reads that state each frame, so scroll scrubbing never fights the
   animation loop.
   ========================================================================== */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/loaders/GLTFLoader.js";

const DRESS_URL = "/thobDress.glb";
const BOX_URL = "/logoBox.glb";

/** Fit a loaded model into a target height and re-center it on the origin. */
function normalize(object3D, targetHeight) {
  const box = new THREE.Box3().setFromObject(object3D);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const scale = targetHeight / (size.y || 1);
  object3D.scale.setScalar(scale);
  object3D.position.sub(center.multiplyScalar(scale));

  const wrapper = new THREE.Group();
  wrapper.add(object3D);
  return { wrapper, size: size.multiplyScalar(scale) };
}

/** Best-effort lid detection so the box can open convincingly. */
function extractLid(root) {
  let lid = null;
  root.traverse((child) => {
    if (!child.isMesh) return;
    const name = (child.name || "").toLowerCase();
    if (/lid|cover|top|cap/.test(name)) lid = lid || child;
  });

  if (!lid) {
    // Fallback: the mesh whose bounds sit highest is treated as the lid.
    let highest = -Infinity;
    root.traverse((child) => {
      if (!child.isMesh) return;
      const b = new THREE.Box3().setFromObject(child);
      if (b.max.y > highest) {
        highest = b.max.y;
        lid = child;
      }
    });
  }
  return lid;
}

export async function createStage({ canvas, viewport, onProgress }) {
  const isMobile = window.matchMedia("(max-width: 860px)").matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile, // antialiasing is the first thing to drop on mobile
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 7.4);

  // Soft studio lighting — no harsh speculars, keeps the white theme calm.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe9e6, 1.05));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(2.6, 3.4, 4.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfeef0, 0.7);
  rim.position.set(-3, 1.5, -3);
  scene.add(rim);

  // ---------------------------------------------------------------- loading
  const loader = new GLTFLoader();
  const progress = { dress: 0, box: 0 };
  const report = () => onProgress && onProgress((progress.dress + progress.box) / 2);

  const load = (url, keyName) =>
    new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          progress[keyName] = 1;
          report();
          resolve(gltf.scene);
        },
        (evt) => {
          if (evt.total) {
            progress[keyName] = evt.loaded / evt.total;
            report();
          }
        },
        reject
      );
    });

  const [dressRaw, boxRaw] = await Promise.all([load(DRESS_URL, "dress"), load(BOX_URL, "box")]);

  const dress = normalize(dressRaw, 3.1);
  const box = normalize(boxRaw, 1.15);

  const dressGroup = dress.wrapper;
  const boxGroup = box.wrapper;
  boxGroup.visible = false;
  scene.add(dressGroup, boxGroup);

  // Put the lid on its own pivot at the rear edge so it hinges open.
  const lidMesh = extractLid(boxRaw);
  let lidPivot = null;
  if (lidMesh) {
    const bounds = new THREE.Box3().setFromObject(lidMesh);
    const local = lidMesh.parent;
    lidPivot = new THREE.Group();
    lidPivot.position.set(0, bounds.max.y, bounds.min.z);
    local.add(lidPivot);
    lidMesh.position.sub(lidPivot.position);
    lidPivot.add(lidMesh);
  }

  // ------------------------------------------------------------------ state
  // Every value is 0..1 (or radians) and driven exclusively by GSAP.
  const state = {
    reveal: 0, // dress rises from below
    rotate: 0, // radians, showcase rotation
    fold: 0, // folding simulation
    boxIn: 0, // box entrance
    lid: 0, // lid open amount
    drop: 0, // folded dress descending into the box
    close: 0, // lid closing
    zoom: 0, // camera dolly toward the piece
    floatAmp: isMobile ? 0.045 : 0.075,
  };

  // --------------------------------------------------------------- rendering
  const clock = new THREE.Clock();
  let visible = true;
  let running = true;

  function resize() {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  // Pause the loop entirely when the canvas is off-screen.
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
    },
    { rootMargin: "10% 0px" }
  );
  io.observe(viewport);

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible) return;

    const t = clock.getElapsedTime();

    // Gentle suspended float — damped out while the piece is being folded.
    const settle = 1 - Math.min(1, state.fold + state.drop);
    const float = Math.sin(t * 0.75) * state.floatAmp * settle;
    const sway = Math.sin(t * 0.45) * 0.035 * settle;

    // Dress: rise, rotate, fold, then drop into the box.
    const baseY = -3.4 + 3.4 * state.reveal;
    dressGroup.position.y = baseY + float - state.drop * 1.55 - state.fold * 0.35;
    dressGroup.position.x = sway * 0.6;
    dressGroup.rotation.y = state.rotate + sway * 0.25;

    // Folding simulation: compress vertically, widen slightly, tilt flat.
    const f = state.fold;
    dressGroup.scale.set(1 + f * 0.2, 1 - f * 0.78, 1 + f * 0.34);
    dressGroup.rotation.x = -f * 0.42;
    dressGroup.rotation.z = f * 0.06;
    dressGroup.visible = state.reveal > 0.001 && state.drop < 0.995;

    // Box: fades/scales in, hinges open, closes again.
    boxGroup.visible = state.boxIn > 0.001;
    boxGroup.position.y = -0.95 + (1 - state.boxIn) * -0.6;
    boxGroup.scale.setScalar(0.82 + state.boxIn * 0.18);
    boxGroup.rotation.y = -0.5 + state.boxIn * 0.5 + sway * 0.15;
    if (lidPivot) {
      const open = Math.max(0, state.lid - state.close);
      lidPivot.rotation.x = -open * 1.85;
    }

    // Camera dolly — slow, always forward.
    camera.position.z = 7.4 - state.zoom * 1.7;
    camera.position.y = 0.15 * state.zoom;
    camera.lookAt(0, -0.2 - state.drop * 0.5, 0);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    state,
    isMobile,
    dispose() {
      running = false;
      io.disconnect();
      renderer.dispose();
    },
  };
}
