/* ==========================================================================
   gallery.js — Scene 5
   Horizontal collection driven by vertical scroll. One pinned ScrollTrigger
   timeline; the centre card scales up while neighbours scale down.
   ========================================================================== */

export function initGallery({ section, track }) {
  const cards = Array.from(track.querySelectorAll("[data-card]"));
  if (!cards.length) return;

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
      scrub: 1, // slight smoothing so it never feels jerky
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  // Focus scaling: proximity to the viewport centre drives the card scale.
  const centerX = () => window.innerWidth / 2;
  const setters = cards.map((card) => gsap.quickTo(card, "scale", { duration: 0.6, ease: "power3.out" }));

  function updateFocus() {
    const mid = centerX();
    cards.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      const cardMid = rect.left + rect.width / 2;
      const dist = Math.min(1, Math.abs(cardMid - mid) / (window.innerWidth * 0.55));
      setters[i](1 - dist * 0.09); // centre ≈ 1.0, neighbours slightly smaller
    });
  }

  gsap.ticker.add(updateFocus);

  // Heading reveal
  gsap.from(section.querySelectorAll(".collection__head > *"), {
    opacity: 0,
    y: 22,
    duration: 1.1,
    stagger: 0.12,
    ease: "power2.out",
    scrollTrigger: { trigger: section, start: "top 78%" },
  });
}
