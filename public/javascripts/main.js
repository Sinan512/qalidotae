/* ==========================================================================
   main.js — orchestration
   Scenes 1-7 + lantern particle system + ambient thobe strip management.
   ========================================================================== */

import { initGallery } from "/javascripts/gallery.js";

const CONTACT = {
  whatsapp: "+917558056808",
  whatsappDisplay: "+917558056808",
  email: "qalidot7@gmail.com",
  instagram: "qalidot.ae",
};

gsap.registerPlugin(ScrollTrigger);

// Use GSAP's recommended mobile-safe scroll approach
ScrollTrigger.config({ limitCallbacks: true, syncInterval: 999 });

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isPhone = () => window.matchMedia("(max-width: 700px)").matches;
const $ = (sel) => document.querySelector(sel);

/* ------------------------------- contact wiring -------------------------- */
function wireContact() {
  const wa = "https://wa.me/" + CONTACT.whatsapp.replace(/[^\d]/g, "");
  document.querySelectorAll("[data-wa-link]").forEach((el) => (el.href = wa));
  document.querySelectorAll("[data-mail-link]").forEach((el) => (el.href = "mailto:" + CONTACT.email));
  document.querySelectorAll("[data-ig-link]").forEach((el) => (el.href = "https://instagram.com/" + CONTACT.instagram));

  const set = (sel, value) => document.querySelectorAll(sel).forEach((el) => (el.textContent = value));
  set("[data-wa-display]", CONTACT.whatsappDisplay);
  set("[data-mail-display]", CONTACT.email);
  set("[data-ig-display]", "@" + CONTACT.instagram);

  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
}

/* ======================== LANTERN PARTICLE SYSTEM ========================
   Warm amber/gold glowing orbs float upward like lantern light.
   Reduced count on all devices for smooth scrolling.
   ========================================================================= */
function initParticles() {
  if (reduceMotion) return;

  const canvas = document.getElementById("particleCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  class Particle {
    constructor() { this.reset(true); }

    reset(initial = false) {
      this.x    = Math.random() * window.innerWidth;
      this.y    = initial ? Math.random() * window.innerHeight : window.innerHeight + 10;
      this.vy   = -(0.35 + Math.random() * 0.9);
      this.vx   = (Math.random() - 0.5) * 0.3;
      this.size = 1.5 + Math.random() * 3.5;
      this.life = 0;
      this.maxLife = 220 + Math.random() * 280;
      const hue  = 36 + Math.random() * 28;
      const sat  = 70 + Math.random() * 30;
      const lum  = 65 + Math.random() * 25;
      this.color = `hsl(${hue},${sat}%,${lum}%)`;
      this.wave  = Math.random() * Math.PI * 2;
    }

    update() {
      this.life++;
      this.y += this.vy;
      this.x += this.vx + Math.sin(this.life * 0.045 + this.wave) * 0.28;
      if (this.life > this.maxLife || this.y < -20) this.reset();
    }

    draw() {
      const prog  = this.life / this.maxLife;
      const alpha = prog < 0.15
        ? prog / 0.15
        : prog > 0.8
          ? (1 - prog) / 0.2
          : 1;

      ctx.save();
      ctx.globalAlpha = alpha * 0.55;

      const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3.5);
      grd.addColorStop(0,   this.color);
      grd.addColorStop(0.4, this.color.replace("hsl", "hsla").replace(")", `,${0.4})`).replace("hsla(", "hsl("));
      grd.addColorStop(1,   "transparent");

      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 0.65, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // Reduced particle count — particles are expensive on mobile compositing
  const COUNT = isPhone() ? 28 : 55;
  const particles = Array.from({ length: COUNT }, () => new Particle());

  // Throttle particle animation to ~20fps — imperceptible for floating orbs
  // but saves significant GPU/CPU budget for the 3D scene during scroll
  let lastFrame = 0;
  const PARTICLE_INTERVAL = isPhone() ? 50 : 33; // ~20fps mobile, ~30fps desktop

  let rafId;
  function loop(now) {
    rafId = requestAnimationFrame(loop);
    if (now - lastFrame < PARTICLE_INTERVAL) return;
    lastFrame = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => { p.update(); p.draw(); });
  }
  rafId = requestAnimationFrame(loop);
}

/* ======================== OPENING SCENE ======================== */
function initOpening() {
  const logo  = $("#heroLogo");
  const slot  = $("#navLogoSlot");
  const nav   = $("#nav");
  const links = $("#navLinks");
  const hint  = $("#openingHint");

  gsap.to(logo, { opacity: 1, duration: 1.8, ease: "power2.out", delay: 0.25 });
  gsap.to(hint, { opacity: 1, duration: 1.2, delay: 1.6,  ease: "power2.out" });

  const park = (parked) => {
    logo.classList.toggle("is-parked", parked);
    nav.classList.toggle("is-landed", parked);
  };

  if (reduceMotion) {
    nav.classList.add("is-active");
    park(true);
    gsap.set(links, { opacity: 1 });
    return;
  }

  const flip = { x: 0, y: 0, scale: 1 };
  function measure() {
    const prev = logo.style.transform;
    logo.style.transform = "none";
    const a = logo.getBoundingClientRect();
    const b = slot.getBoundingClientRect();
    logo.style.transform = prev;
    flip.x     = b.left - a.left;
    flip.y     = b.top  - a.top;
    flip.scale = a.width ? b.width / a.width : 1;
  }
  measure();
  ScrollTrigger.addEventListener("refreshInit", measure);

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: "#opening",
      start: "top top",
      end: "bottom top",
      scrub: 1.5, // slightly looser scrub = less janky on slow devices
      invalidateOnRefresh: true,
      onEnter:     () => nav.classList.add("is-active"),
      onLeaveBack: () => { nav.classList.remove("is-active"); park(false); },
      onLeave:     () => park(true),
      onEnterBack: () => park(false),
    },
  });

  tl.to(hint, { opacity: 0, duration: 0.1 }, 0)
    .to(logo, {
      x: () => flip.x, y: () => flip.y, scale: () => flip.scale,
      ease: "power2.inOut", duration: 1,
    }, 0)
    .fromTo(links,
      { opacity: 0, x: 26 },
      { opacity: 1, x: 0, ease: "power2.out", duration: 0.35 },
      0.62
    );

  ScrollTrigger.create({
    start: "top -60", end: 99999,
    onToggle: (self) => nav.classList.toggle("is-stuck", self.isActive),
  });
}

/* ======================== 3D STORY SCENES 2–4 ========================
   Beat map:
     0.0–2.0   rise + camera dolly + hero copy
     2.1–6.7   rotate ~150° and back, four panels
     6.9–14.5  fold → box rises → lid LIFTS UP → dress lowers in → lid closes
   ==================================================================== */
function initStory(stage) {
  const { state } = stage;
  const panels = gsap.utils.toArray(".panel");
  const SWEEP  = (stage.isPhone ? 115 : 150) * (Math.PI / 180);

  // scrub: 2 on mobile gives the GPU more time between scroll ticks — reduces
  // the "jitter while scrolling" that happens when scrub is too tight
  const scrubSpeed = isPhone() ? 2 : 1;

  const tl = gsap.timeline({
    defaults: { ease: "power2.inOut" },
    scrollTrigger: {
      trigger: "#stage",
      start: "top top",
      end: "bottom bottom",
      pin: "#stageViewport",
      pinType: "fixed",
      scrub: scrubSpeed,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  /* Scene 2 — rise + dolly */
  tl.to(state, { reveal: 1, duration: 1.4, ease: "power3.out" }, 0)
    .to(state, { zoom: 1, duration: 2.4, ease: "none" }, 0.2)
    .to("#heroCopy", { opacity: 1, duration: 0.7, ease: "power2.out" }, 0.5)
    .to("#heroCopy", { opacity: 0, duration: 0.5 }, 1.9);

  /* Scene 3 — rotate + panels */
  tl.to(state, { rotate: SWEEP, duration: 2.4, ease: "power1.inOut" }, 2.1);
  tl.to(state, { rotate: 0,     duration: 2.0, ease: "power1.inOut" }, 4.7);

  panels.forEach((panel, i) => {
    const at = 2.3 + i * 1.05;
    tl.fromTo(panel,
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" },
      at
    ).to(panel, { opacity: 0, y: -20, duration: 0.45 }, at + 0.75);
  });

  /* Scene 4 — packaging sequence */
  tl.to("#packaging", { opacity: 1, duration: 0.6, ease: "power2.out" }, 6.9)
    .to(state, { pack: 1,    duration: 1.4, ease: "power2.inOut" }, 6.9)
    .to(state, { fold: 0.45, duration: 0.9, ease: "power2.inOut" }, 7.1)
    .to(state, { boxIn: 1,   duration: 1.0, ease: "power3.out"  }, 8.2)
    .to(state, { fold: 1,    duration: 1.0, ease: "power2.inOut" }, 8.3)
    .to(state, { lid: 1,     duration: 1.6, ease: "power1.inOut" }, 8.8)
    .to(state, { slide: 1,   duration: 1.5, ease: "power2.inOut" }, 10.4)
    .to(state, { close: 1,   duration: 1.4, ease: "power2.inOut" }, 12.2)
    .to({}, { duration: 0.9 }, 13.6)
    .to("#packaging", { opacity: 0, duration: 0.5 }, 14.0);
}

/* ======================== REVEALS — scenes 6–7 ======================== */
function initReveals() {
  gsap.utils.toArray(".reveal").forEach((el) => {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 1, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });

  const top = $("#backToTop");
  if (top) {
    top.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }
}

/* ======================== BOOTSTRAP ======================== */
async function boot() {
  wireContact();
  initParticles();
  initOpening();
  initGallery({
    section: $("#collection"),
    track: $("#galleryTrack"),
    reduceMotion,
    isPhone,
  });
  initReveals();

  const loaderEl = $("#loader");
  const fillEl   = $("#loaderFill");
  const canvas   = $("#scene");
  const viewport = $("#stageViewport");

  try {
    const { createStage } = await import("/javascripts/three-scene.js");
    const stage = await createStage({
      canvas,
      viewport,
      onProgress: (p) => {
        if (fillEl) fillEl.style.width = Math.round(p * 100) + "%";
      },
    });
    loaderEl.classList.add("is-done");
    initStory(stage);
    ScrollTrigger.addEventListener("refresh", stage.refresh);
    ScrollTrigger.refresh();
  } catch (err) {
    console.error("3D stage unavailable:", err);
    loaderEl.classList.add("is-done");
    document.getElementById("stage")?.classList.add("is-fallback");
    gsap.set(["#heroCopy", ".panel", "#packaging"], { opacity: 1 });
  }
}

// Boot on window load — guarantees DOM + GSAP globals are fully ready.
// This is more reliable than requestIdleCallback on mobile Safari.
if (document.readyState === "complete") {
  boot();
} else {
  window.addEventListener("load", boot, { once: true });
}
