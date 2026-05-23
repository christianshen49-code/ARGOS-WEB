"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * GSAP scroll choreography — four-section cinematic sequence.
 *
 * Depends on <GlobalScrollSync /> (layout.tsx) having already:
 *   · Called gsap.registerPlugin(ScrollTrigger)
 *   · Wired lenis.on("scroll", ScrollTrigger.update)
 *   · Tied lenis.raf to gsap.ticker
 *
 * Deferred one rAF so GlobalScrollSync's sibling effect completes first.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DOM animations
 *
 * Phase 1  [0% → 35% of #platform]
 *   Hero UI (#hero-ui) parallaxes upward and fades: y 0 → -150, opacity 1 → 0.
 *   scrub: 1.5 — heavy liquid lag so the text feels pulled away by gravity.
 *
 * Phase 2  [15% → 72% of #platform]  ← "Dive Through the Orb"
 *   OGL Orb (#orb-bg) explodes: scale 1→5, blur 0→50px, opacity 1→0.
 *   scrub: 1.5 — same damping so orb and text lift stay in sync.
 *
 * Phase 3  [28% → 78% of #platform]
 *   Three.js particle canvas (#three-scene) fades in: opacity 0 → 1.
 *   scrub: 1.5 — consistent with other phases.
 *
 * Phase 4  [#pillars enters viewport]
 *   Pillars heading text staggered in via power4.out — NOT scrubbed, once.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WebGL scrollState (0 → 3) is driven by GlobalScrollSync (layout.tsx)
 * via pure DOM arithmetic — not by ScrollTrigger callbacks here.
 * ScrollController is DOM-only: parallax, fade, and entrance animations.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function ScrollController() {
  useEffect(() => {
    let rafId: number;
    let ctx: gsap.Context;

    rafId = requestAnimationFrame(() => {
      ctx = gsap.context(() => {
        // Note: ScrollTrigger.refresh() is called AFTER the context block via
        // setTimeout below — it must run after all triggers are registered.

        // ── Phase 1: Hero DOM lifts out ──────────────────────────────────
        gsap.to("#hero-ui", {
          y: -150,
          opacity: 0,
          ease: "power2.inOut",
          scrollTrigger: {
            trigger: "#platform",
            start: "top top",
            end: "35% top",
            scrub: 1.5,
          },
        });

        // ── Phase 2: OGL Orb — "Dive Through" cinematic explosion ────────
        // scale:5 + blur:50px makes the orb fill the screen and then white-
        // out — the viewer feels like they've dived through its surface.
        // A single composite tween is cheaper GPU-side than three parallel
        // tweens fighting over the same element's style.
        gsap.to("#orb-bg", {
          scale: 5,
          opacity: 0,
          filter: "blur(50px)",
          ease: "power2.inOut",
          scrollTrigger: {
            trigger: "#platform",
            start: "15% top",
            end: "72% top",
            scrub: 1.5,
          },
        });

        // ── Phase 3 removed ──────────────────────────────────────────────
        // #three-scene is always visible (opacity:1 from mount — no inline
        // style:0 on the div).  The OGL orb (#orb-bg, Phase 2) sits on top
        // via DOM stacking order and reveals the Three.js canvas naturally as
        // it scales up and fades out.  A separate GSAP scrub on the canvas
        // opacity is no longer needed and previously caused a dead-black
        // regression when scroll-behavior:smooth staled the ScrollTrigger.

        // ── Phase 4: Pillars heading text (one-shot, power4.out) ─────────
        // Target the direct children of #pillars-text (eyebrow, h2, body).
        // SpotlightCard glass cards keep their own framer-motion entrance
        // (y:150 / blur:20px / rotateX:15 / expo.out) which is already more
        // dramatic than spec — no conflict since these are different elements.
        gsap.from("#pillars-text > *", {
          y: 60,
          opacity: 0,
          filter: "blur(8px)",
          duration: 1.1,
          ease: "power4.out",
          stagger: 0.1,
          scrollTrigger: {
            trigger: "#pillars",
            start: "top 82%",
            toggleActions: "play none none none",
            once: true,
          },
        });

        // ── FinalCta: glass container floats up from y:200 (The Abyss) ───
        // The massive glass card starts 200px below its resting position and
        // rises into place as #access scrolls into view.  scrub:1.5 gives it
        // the same heavy-liquid lag as the other parallax phases — consistent
        // feel across the full scroll journey.
        gsap.from("#access-container", {
          y: 200,
          ease: "none",
          scrollTrigger: {
            trigger: "#access",
            start:   "top bottom",   // begins when section top hits viewport bottom
            end:     "top 20%",      // fully settled when section top is 20% down
            scrub:   1.5,
          },
        });

      });

      // Refresh after all triggers are registered AND after a brief layout-settle
      // delay (80 ms).  This catches position shifts from Framer Motion entrance
      // animations, IntroCurtain, and any other components that affect document
      // height after mount.  Without this, triggers fire at wrong scroll offsets
      // on route-return visits, making the scroll-to-WebGL transitions appear dead.
      setTimeout(() => ScrollTrigger.refresh(), 80);
    });

    return () => {
      cancelAnimationFrame(rafId);
      ctx?.revert();
    };
  }, []);

  return null;
}
