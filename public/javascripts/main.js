/* ==========================================================================
   main.js — orchestration
   Scene 1 (logo -> navbar), Scenes 2–4 (pinned 3D story), Scene 5 (gallery),
   Scenes 6–7 (contact + footer). One ScrollTrigger timeline per scene; no
   ad-hoc scroll listeners anywhere.
   ========================================================================== */

import { initGallery } from "/javascripts/gallery.js";

/* ---------------------------------------------------------------------------
   CONTACT CONFIG — placeholder data, swap these three values for the real ones
   --------------------------------------------------------------------------- */
const CONTACT = {
  whatsapp: "+917558056808", // digits only for the wa.me link
  whatsappDisplay: "+917558056808",
  email: "qalidot7@gmail.com",
  instagram: "qalidot.ae",
};

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isPhone = () => window.matchMedia("(max-width: 700px)").matches;
const $ = (sel) => document.querySelector(sel);

/* ------------------------------- contact wiring -------------------------- */
function wireContact() {
  const wa = "https://wa.me/" + CONTACT.whatsapp.replace(/[^\d]/g, "");
  document.querySelectorAll("[data-wa-link]").forEach((el) => (el.href = wa));
  document
    .querySelectorAll("[data-mail-link]")
    .forEach((el) => (el.href = "mailto:" + CONTACT.email));
  document
    .querySelectorAll("[data-ig-link]")
    .forEach((el) => (el.href = "https://instagram.com/" + CONTACT.instagram));

  const set = (sel, value) =>
    document.querySelectorAll(sel).forEach((el) => (el.textContent = value));
  set("[data-wa-display]", CONTACT.whatsappDisplay);
  set("[data-mail-display]", CONTACT.email);
  set("[data-ig-display]", "@" + CONTACT.instagram);

  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
}

/* ----------------------- Scene 1: logo into the navbar -------------------
   The flying mark is `position: fixed`, so its untransformed box never moves
   while the page scrolls. That makes a true FLIP possible: we measure the
   start box and the navbar slot once per ScrollTrigger refresh and animate
   from `transform-origin: 0 0`, so the mark lands exactly on the slot at every
   viewport width. Once it has landed, the real navbar logo takes over.
   ------------------------------------------------------------------------ */
function initOpening() {
  const logo = $("#heroLogo");
  const slot = $("#navLogoSlot");
  const nav = $("#nav");
  const links = $("#navLinks");
  const hint = $("#openingHint");

  // Slow, calm fade-in of the mark on a plain background.
  gsap.to(logo, { opacity: 1, duration: 1.8, ease: "power2.out", delay: 0.25 });
  gsap.to(hint, { opacity: 1, duration: 1.2, delay: 1.6, ease: "power2.out" });

  const park = (parked) => {
    logo.classList.toggle("is-parked", parked); // hides the flying copy
    nav.classList.toggle("is-landed", parked); // reveals the navbar copy
  };

  if (reduceMotion) {
    nav.classList.add("is-active");
    park(true);
    gsap.set(links, { opacity: 1 });
    return;
  }

  // FLIP measurement, cached per refresh so scrubbing stays cheap and stable.
  const flip = { x: 0, y: 0, scale: 1 };
  function measure() {
    const prev = logo.style.transform;
    logo.style.transform = "none";
    const a = logo.getBoundingClientRect();
    const b = slot.getBoundingClientRect();
    logo.style.transform = prev;

    flip.x = b.left - a.left;
    flip.y = b.top - a.top;
    flip.scale = a.width ? b.width / a.width : 1;
  }
  measure();
  ScrollTrigger.addEventListener("refreshInit", measure);

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: "#opening",
      start: "top top",
      end: "bottom top",
      scrub: 1, // scrubbed with smoothing = no sudden jumps
      invalidateOnRefresh: true,
      onEnter: () => nav.classList.add("is-active"),
      onLeaveBack: () => {
        nav.classList.remove("is-active");
        park(false);
      },
      onLeave: () => park(true),
      onEnterBack: () => park(false),
    },
  });

  tl.to(hint, { opacity: 0, duration: 0.1 }, 0).to(
    logo,
    {
      x: () => flip.x,
      y: () => flip.y,
      scale: () => flip.scale,
      ease: "power2.inOut",
      duration: 1,
    },
    0
  );

  // Nav links drift in from the right as the mark lands.
  tl.fromTo(
    links,
    { opacity: 0, x: 26 },
    { opacity: 1, x: 0, ease: "power2.out", duration: 0.35 },
    0.62
  );

  // Sticky bar gains its soft shadow only once it's actually holding content.
  ScrollTrigger.create({
    start: "top -60",
    end: 99999,
    onToggle: (self) => nav.classList.toggle("is-stuck", self.isActive),
  });
}

/* ----------------- Scenes 2–4: one pinned, scrubbed timeline --------------
   Beat map (timeline seconds):
     0.0–2.0  rise + camera dolly + hero copy
     2.1–6.7  rotate ~150° out and back, four copy panels keyed to it
     6.9–13   fold, box enters, lid opens, piece slides in, lid closes
   ------------------------------------------------------------------------ */
function initStory(stage) {
  const { state } = stage;
  const panels = gsap.utils.toArray(".panel");
  // ~150° out and back — deliberately never a full spin. Narrower on phones.
  const SWEEP = (stage.isPhone ? 115 : 150) * (Math.PI / 180);

  const tl = gsap.timeline({
    defaults: { ease: "power2.inOut" },
    scrollTrigger: {
      trigger: "#stage",
      start: "top top",
      end: "bottom bottom",
      pin: "#stageViewport",
      pinType: "fixed",
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  /* Scene 2 — the piece rises and the camera moves in */
  tl.to(state, { reveal: 1, duration: 1.4, ease: "power3.out" }, 0)
    .to(state, { zoom: 1, duration: 2.4, ease: "none" }, 0.2)
    .to("#heroCopy", { opacity: 1, duration: 0.7, ease: "power2.out" }, 0.5)
    .to("#heroCopy", { opacity: 0, duration: 0.5 }, 1.9);

  /* Scene 3 — rotate ~150°, then back to a guaranteed front view */
  tl.to(state, { rotate: SWEEP, duration: 2.4, ease: "power1.inOut" }, 2.1);
  tl.to(state, { rotate: 0, duration: 2.0, ease: "power1.inOut" }, 4.7);

  panels.forEach((panel, i) => {
    const at = 2.3 + i * 1.05;
    tl.fromTo(
      panel,
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" },
      at
    ).to(panel, { opacity: 0, y: -20, duration: 0.45 }, at + 0.75);
  });

  /* Scene 4 — fold, box opens, piece slides in, lid closes */
  tl.to("#packaging", { opacity: 1, duration: 0.6, ease: "power2.out" }, 6.9)
    .to(state, { pack: 1, duration: 1.4, ease: "power2.inOut" }, 6.9)
    // two-beat fold so it reads as cloth, not one squash
    .to(state, { fold: 0.45, duration: 0.9, ease: "power2.inOut" }, 7.1)
    .to(state, { boxIn: 1, duration: 1.0, ease: "power3.out" }, 8.0)
    .to(state, { fold: 1, duration: 1.0, ease: "power2.inOut" }, 8.1)
    // The box now stays SHUT and logo-forward while the piece goes in behind
    // it, so the branded panel is the only thing facing the camera.
    // slide behind the measured box
    .to(state, { slide: 1, duration: 1.2, ease: "power2.inOut" }, 9.7)
    // the lid only closes once the piece is fully inside and faded out
    .to(state, { close: 1, duration: 1.1, ease: "power2.inOut" }, 11.2)
    // brief hold on the closed, branded box
    .to({}, { duration: 0.9 }, 12.3)
    .to("#packaging", { opacity: 0, duration: 0.5 }, 12.7);
}

/* --------------------------- Scenes 6–7: reveals ------------------------- */
function initReveals() {
  gsap.utils.toArray(".reveal").forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });

  const top = $("#backToTop");
  if (top) {
    top.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

/* ------------------------------- bootstrap ------------------------------- */
async function boot() {
  wireContact();
  initOpening();
  initGallery({
    section: $("#collection"),
    track: $("#galleryTrack"),
    reduceMotion,
    isPhone,
  });
  initReveals();

  const loader = $("#loader");
  const fill = $("#loaderFill");
  const canvas = $("#scene");
  const viewport = $("#stageViewport");

  try {
    // 3D module + GLB assets load after first paint, never blocking the opening.
    const { createStage } = await import("/javascripts/three-scene.js");
    const stage = await createStage({
      canvas,
      viewport,
      onProgress: (p) => {
        if (fill) fill.style.width = Math.round(p * 100) + "%";
      },
    });
    loader.classList.add("is-done");
    initStory(stage);
    ScrollTrigger.addEventListener("refresh", stage.refresh);
    ScrollTrigger.refresh();
  } catch (err) {
    // Graceful degradation: the copy-driven scenes still work without WebGL.
    console.error("3D stage unavailable:", err);
    loader.classList.add("is-done");
    document.getElementById("stage")?.classList.add("is-fallback");
    gsap.set(["#heroCopy", ".panel", "#packaging"], { opacity: 1 });
  }
}

// Defer the heavy work until the browser is idle after first paint.
if ("requestIdleCallback" in window) {
  requestIdleCallback(boot, { timeout: 1200 });
} else {
  window.addEventListener("load", boot);
}
