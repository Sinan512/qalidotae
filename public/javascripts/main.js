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
  whatsapp: "+971500000000", // digits only for the wa.me link
  whatsappDisplay: "+971 50 000 0000",
  email: "hello@qalid.com",
  instagram: "qalid",
};

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

/* ----------------------- Scene 1: logo into the navbar ------------------- */
function initOpening() {
  const logo = $("#heroLogo");
  const slot = $("#navLogoSlot");
  const nav = $("#nav");
  const links = $("#navLinks");
  const hint = $("#openingHint");

  // Slow, calm fade-in of the mark on a plain background.
  gsap.to(logo, { opacity: 1, duration: 1.8, ease: "power2.out", delay: 0.25 });
  gsap.to(hint, { opacity: 1, duration: 1.2, delay: 1.6, ease: "power2.out" });

  if (reduceMotion) {
    nav.classList.add("is-active");
    gsap.set(links, { opacity: 1 });
    return;
  }

  // The logo physically travels from centre to the navbar slot as you scroll.
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: "#opening",
      start: "top top",
      end: "bottom top",
      scrub: 1, // scrubbed with smoothing = no sudden jumps
      invalidateOnRefresh: true,
      onEnter: () => nav.classList.add("is-active"),
      onLeaveBack: () => nav.classList.remove("is-active"),
    },
  });

  tl.to(hint, { opacity: 0, duration: 0.1 }, 0).to(
    logo,
    {
      // FLIP-style measurement, recomputed on refresh so it stays responsive
      x: () => {
        const a = logo.getBoundingClientRect();
        const b = slot.getBoundingClientRect();
        return b.left + b.width / 2 - (a.left + a.width / 2);
      },
      y: () => {
        const a = logo.getBoundingClientRect();
        const b = slot.getBoundingClientRect();
        return b.top + b.height / 2 - (a.top + a.height / 2);
      },
      scale: () => slot.getBoundingClientRect().width / logo.getBoundingClientRect().width,
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

/* ----------------- Scenes 2–4: one pinned, scrubbed timeline -------------- */
function initStory(stage) {
  const { state } = stage;
  const panels = gsap.utils.toArray(".panel");
  // ~150° out and back — deliberately never a full spin.
  const SWEEP = (stage.isMobile ? 120 : 150) * (Math.PI / 180);

  const tl = gsap.timeline({
    defaults: { ease: "power2.inOut" },
    scrollTrigger: {
      trigger: "#stage",
      start: "top top",
      end: "bottom bottom",
      pin: "#stageViewport",
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

  /* Scene 3 — rotate ~150°, hold, rotate back; copy keyed to each quarter */
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

  /* Scene 4 — front view, elegant fold, box opens, piece settles inside */
  tl.to("#packaging", { opacity: 1, duration: 0.6, ease: "power2.out" }, 6.9)
    // staged fold so it reads as cloth, not a single squash
    .to(state, { fold: 0.45, duration: 0.9, ease: "power2.inOut" }, 7.1)
    .to(state, { fold: 1, duration: 1.1, ease: "power2.inOut" }, 8.1)
    .to(state, { boxIn: 1, duration: 1.0, ease: "power3.out" }, 8.0)
    .to(state, { lid: 1, duration: 0.9, ease: "power2.out" }, 8.9)
    .to(state, { drop: 1, duration: 1.2, ease: "power2.inOut" }, 9.7)
    .to(state, { close: 1, duration: 1.1, ease: "power2.inOut" }, 10.9)
    // brief hold on the closed, branded box
    .to({}, { duration: 0.9 }, 12.0)
    .to("#packaging", { opacity: 0, duration: 0.5 }, 12.6);
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
  initGallery({ section: $("#collection"), track: $("#galleryTrack") });
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
    ScrollTrigger.refresh();
  } catch (err) {
    // Graceful degradation: the copy-driven scenes still work without WebGL.
    console.error("3D stage unavailable:", err);
    loader.classList.add("is-done");
    gsap.set(["#heroCopy", ".panel", "#packaging"], { opacity: 1 });
  }
}

// Defer the heavy work until the browser is idle after first paint.
if ("requestIdleCallback" in window) {
  requestIdleCallback(boot, { timeout: 1200 });
} else {
  window.addEventListener("load", boot);
}
