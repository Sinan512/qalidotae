/* ==========================================================================
   gallery.js — Scene 5
   The collection is a continuous marquee: the cards always drift right to
   left at a constant speed on every breakpoint, independent of scrolling.
   The card list is duplicated once so the loop is seamless, and the motion
   pauses while the visitor hovers (desktop) or holds a finger on it (touch).
   Reduced motion falls back to a plain, natively swipeable row.
   ========================================================================== */

const SPEED = 46; // px per second, right to left

export function initGallery({ section, track, reduceMotion }) {
  const cards = Array.from(track.querySelectorAll("[data-card]"));
  if (!cards.length) return;

  // Heading reveal (all breakpoints)
  gsap.from(section.querySelectorAll(".collection__head > *"), {
    opacity: 0,
    y: 22,
    duration: 1.1,
    stagger: 0.12,
    ease: "power2.out",
    scrollTrigger: { trigger: section, start: "top 78%" },
  });

  if (reduceMotion) {
    section.classList.add("is-swipe");
    return; // CSS handles the swipeable track
  }

  section.classList.add("is-marquee");

  // Seamless loop: a hidden clone of the whole row follows the original.
  cards.forEach((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.removeAttribute("data-card");
    clone.setAttribute("data-card-clone", "");
    track.appendChild(clone);
  });

  // Half the track width is exactly one full pass of the original cards.
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

  // Wait for the lazy images to settle before measuring the row.
  build();
  window.addEventListener("load", build);
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 200);
  });

  // Pause so the visitor can actually look at a piece.
  const pause = () => tween && tween.pause();
  const play = () => tween && tween.play();
  track.addEventListener("mouseenter", pause);
  track.addEventListener("mouseleave", play);
  track.addEventListener("touchstart", pause, { passive: true });
  track.addEventListener("touchend", play, { passive: true });
  track.addEventListener("touchcancel", play, { passive: true });

  // Don't burn frames while the section is off-screen.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? play() : pause())),
      { rootMargin: "120px" }
    ).observe(section);
  }
}
