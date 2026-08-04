/* ==========================================================================
   gallery.js — Scene 5
   Desktop/tablet: horizontal collection driven by vertical scroll (one pinned
   ScrollTrigger timeline, centre card scales up).
   Phones: native touch swiping with scroll-snap — smoother than a pinned
   scrub on touch, and what users expect there.
   ========================================================================== */

export function initGallery({ section, track, reduceMotion, isPhone }) {
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

  const touchMode = () => (isPhone ? isPhone() : false) || reduceMotion;

  if (touchMode()) {
    section.classList.add("is-swipe");
    return; // CSS handles the swipeable track
  }

  const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

  gsap.to(track, {
    x: () => -distance(),
    ease: "none",
    scrollTrigger: {
      trigger: section,
      start: "top top",
      // Runway length matches the horizontal distance for a 1:1 scroll feel
      end: () => "+=" + (distance() + window.innerHeight * 0.6),
      pin: true,
      pinType: "fixed",
      scrub: 1, // slight smoothing so it never feels jerky
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  // Focus scaling: proximity to the viewport centre drives the card scale.
  const setters = cards.map((card) =>
    gsap.quickTo(card, "scale", { duration: 0.6, ease: "power3.out" })
  );

  function updateFocus() {
    const mid = window.innerWidth / 2;
    cards.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      if (rect.right < -200 || rect.left > window.innerWidth + 200) return;
      const cardMid = rect.left + rect.width / 2;
      const dist = Math.min(1, Math.abs(cardMid - mid) / (window.innerWidth * 0.55));
      setters[i](1 - dist * 0.09); // centre ≈ 1.0, neighbours slightly smaller
    });
  }

  gsap.ticker.add(updateFocus);
}
