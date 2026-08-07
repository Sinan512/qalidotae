/* ==========================================================================
   gallery.js — Scene 5
   Continuous marquee with lightbox on card click.
   ========================================================================== */

const SPEED = 46;

export function initGallery({ section, track, reduceMotion }) {
  const cards = Array.from(track.querySelectorAll("[data-card]"));
  if (!cards.length) return;

  // Collect all image sources for lightbox navigation
  const images = cards.map((c) => ({
    src: c.querySelector("img")?.src || "",
    alt: c.querySelector("img")?.alt || "",
    caption: c.querySelector("figcaption")?.textContent || "",
  }));

  // ========================= LIGHTBOX =========================
  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("role", "dialog");
  lb.innerHTML = `
    <button class="lightbox__prev" aria-label="Previous">&#8592;</button>
    <img class="lightbox__img" src="" alt="" />
    <button class="lightbox__next" aria-label="Next">&#8594;</button>
    <button class="lightbox__close" aria-label="Close">&#10005;</button>
    <span class="lightbox__caption"></span>
  `;
  document.body.appendChild(lb);

  const lbImg     = lb.querySelector(".lightbox__img");
  const lbCaption = lb.querySelector(".lightbox__caption");
  const lbClose   = lb.querySelector(".lightbox__close");
  const lbPrev    = lb.querySelector(".lightbox__prev");
  const lbNext    = lb.querySelector(".lightbox__next");
  let current = 0;

  function openLightbox(idx) {
    current = ((idx % images.length) + images.length) % images.length;
    lbImg.src    = images[current].src;
    lbImg.alt    = images[current].alt;
    lbCaption.textContent = images[current].caption;
    lb.classList.add("is-open");
    document.body.style.overflow = "hidden";
    lbClose.focus();
  }

  function closeLightbox() {
    lb.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function navigate(dir) {
    current = ((current + dir) % images.length + images.length) % images.length;
    lbImg.style.opacity = "0";
    setTimeout(() => {
      lbImg.src = images[current].src;
      lbImg.alt = images[current].alt;
      lbCaption.textContent = images[current].caption;
      lbImg.style.opacity = "1";
    }, 180);
  }

  lbImg.style.transition = "opacity 0.18s ease";
  lbClose.addEventListener("click", closeLightbox);
  lbPrev.addEventListener("click", () => navigate(-1));
  lbNext.addEventListener("click", () => navigate(1));
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("is-open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft")  navigate(-1);
    if (e.key === "ArrowRight") navigate(1);
  });

  // Attach click to original cards
  cards.forEach((card, i) => {
    card.addEventListener("click", () => openLightbox(i));
    card.style.cursor = "pointer";
  });

  // Heading reveal
  gsap.from(section.querySelectorAll(".collection__head > *"), {
    opacity: 0, y: 22, duration: 1.1, stagger: 0.12, ease: "power2.out",
    scrollTrigger: { trigger: section, start: "top 78%" },
  });

  if (reduceMotion) {
    section.classList.add("is-swipe");
    return;
  }

  section.classList.add("is-marquee");

  // Duplicate cards for seamless loop — clones also open lightbox by original index
  cards.forEach((card, i) => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.removeAttribute("data-card");
    clone.setAttribute("data-card-clone", "");
    clone.addEventListener("click", () => openLightbox(i));
    track.appendChild(clone);
  });

  const half = () => track.scrollWidth / 2;
  let tween = null;

  function build() {
    const distance = half();
    if (!distance) return;
    if (tween) tween.kill();
    gsap.set(track, { x: 0 });
    tween = gsap.to(track, {
      x: -distance,
      duration: distance / SPEED,
      ease: "none",
      repeat: -1,
      onRepeat: () => gsap.set(track, { x: 0 }),
    });
  }

  build();
  window.addEventListener("load", build);
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 200);
  });

  const pause = () => tween && tween.pause();
  const play  = () => tween && tween.play();
  track.addEventListener("mouseenter", pause);
  track.addEventListener("mouseleave", play);
  track.addEventListener("touchstart", pause, { passive: true });
  track.addEventListener("touchend",   play,  { passive: true });
  track.addEventListener("touchcancel",play,  { passive: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? play() : pause())),
      { rootMargin: "120px" }
    ).observe(section);
  }
}
