"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SectionTransition } from "./SectionTransition";
import { SpotlightCard } from "./SpotlightCard";
import { useHLSVideo } from "@/ui/nodes/useHLSVideo";
import { NodeCanvas } from "@/ui/nodes/NodeCanvas";

const NODES = [
  {
    city: "Los Angeles",
    code: "LAX",
    coords: "34.0522° N · 118.2437° W",
    h200: 168,
    role: "Render primary",
  },
  {
    city: "Toronto",
    code: "YYZ",
    coords: "43.6532° N · 79.3832° W",
    h200: 96,
    role: "Orchestration",
  },
  {
    city: "Sheffield",
    code: "SHF",
    coords: "53.3811° N · 1.4701° W",
    h200: 72,
    role: "EU edge",
  },
];

/**
 * Nodes — full-screen cinematic dashboard (100vh pinned).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Layout layers (back → front)
 *
 *   z-0  NodeCanvas (WebGL)
 *        HLS video treated as holographic duotone: neon cyan / deep violet,
 *        scanlines, radial alpha mask. uOpacity tweens 0 → 0.4 via the
 *        scrubbed GSAP timeline.
 *
 *   z-10 DOM UI
 *        Left-aligned heading block (#nodes-heading) + 3 city cards grid.
 *        ALL entrance animations owned by GSAP (no framer-motion on this
 *        section) to prevent conflicts with the ScrollTrigger pin.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Why ScrollFrame and Reveal are removed:
 *
 *   · ScrollFrame attaches framer-motion useScroll to the element. When
 *     GSAP pins the section (position:fixed), getBoundingClientRect freezes,
 *     so the scroll-mapped transforms (scale, opacity, y) lock at the wrong
 *     value for the entire pin duration — causing a blank or distorted frame.
 *
 *   · Reveal/RevealItem use whileInView which fires the moment the section
 *     is in the viewport. Since the section is already in-view when pinning
 *     begins, framer-motion plays the animations instantly, stealing them
 *     from the scrubbed GSAP timeline.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * GSAP Pin architecture
 *
 *   pin: true        — section is fixed at top:0 during the pin window
 *   pinSpacing: true — inserts a 100vh spacer after the section so the
 *                      rest of the page flows correctly beneath it
 *   start: "top top" — pin triggers the moment section hits viewport top
 *   end:   "+=100%"  — pin holds for an additional 100vh of scroll travel
 *   scrub: true      — timeline progress is directly tied to Lenis-smoothed
 *                      scroll; Lenis's 1.25s expo-out easing acts as the
 *                      physical damping (no extra scrub lag needed)
 *   anticipatePin: 1 — starts pin a few px early to absorb scroll overshoots
 *                      common with smooth-scroll libraries
 *
 * Timeline (relative durations, total = 1.0):
 *   0.00 → 0.60   video glow fades in (power2.out)
 *   0.00 → 0.40   heading children stagger in (power3.out, stagger 0.08)
 *   0.28 → 0.78   city cards stagger in (power3.out, stagger 0.10)
 */
export function Nodes() {
  const sectionRef = useRef<HTMLElement>(null);

  // ── HLS VideoTexture (stable ref, never triggers re-render) ─────────────
  const hlsTexture = useHLSVideo();

  // ── Video shader opacity (GSAP tweens .current, useFrame reads it) ───────
  const videoOpacity = useRef<number>(0);

  // ── GSAP: pin + scrubbed entrance timeline ───────────────────────────────
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    let rafId: number;
    let ctx: gsap.Context;

    // Defer one rAF — same pattern as ScrollController — so that
    // SmoothScroll's sibling useEffect has fully wired Lenis ↔ ScrollTrigger
    // before we create the pin trigger. Without this, the pin's spacer
    // height isn't reflected in the initial ScrollTrigger.refresh() call.
    rafId = requestAnimationFrame(() => {
      ctx = gsap.context(() => {
        // ── Set initial hidden states ──────────────────────────────────
        // gsap.from() would set these on trigger; we use gsap.set() here so
        // elements are invisible from mount, preventing a flash of unstyled
        // content on fast scroll-to-section (deep-link, programmatic scroll).
        gsap.set("#nodes-heading > *", { opacity: 0, y: 30, filter: "blur(8px)" });
        gsap.set(".node-card",         { opacity: 0, y: 50 });

        // ── Scrubbed entrance timeline ─────────────────────────────────
        const tl = gsap.timeline({
          defaults: { ease: "power3.out" },
          scrollTrigger: {
            trigger:      sectionRef.current,
            pin:          true,
            pinSpacing:   true,
            start:        "top top",
            end:          "+=100%",
            scrub:        true,
            anticipatePin: 1,
          },
        });

        // Phase A — video glow (starts immediately, soft power2.out arc)
        tl.to(videoOpacity, {
          current:  0.4,
          duration: 0.6,
          ease:     "power2.out",
        }, 0);

        // Phase B — heading text children stagger in
        tl.to("#nodes-heading > *", {
          opacity:  1,
          y:        0,
          filter:   "blur(0px)",
          stagger:  0.08,
          duration: 0.40,
        }, 0); // starts in sync with video glow

        // Phase C — city cards stagger up (slightly after heading peak)
        tl.to(".node-card", {
          opacity:  1,
          y:        0,
          stagger:  0.10,
          duration: 0.45,
        }, 0.28); // 28 % into timeline ≈ when heading is mostly visible

      }, sectionRef); // scope — selectors resolve only within #nodes
    });

    return () => {
      cancelAnimationFrame(rafId);
      ctx?.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="nodes"
      // h-screen: true 100vh — no padding-top/bottom that would push content
      // outside the viewport.  overflow-hidden clips NodeCanvas edges.
      className="relative h-screen w-full bg-transparent overflow-hidden"
    >
      {/* Cosmetic top-seam blend from Pillars */}
      <SectionTransition tint="rgba(0, 229, 255, 0.12)" />

      {/* ── Holographic video mesh (z-0) ──────────────────────────────────
          absolute inset-0 so it fills the full 100vh.
          AdditiveBlending — only bright (cyan) pixels add light; #0a0a0a
          shows through wherever the video is dark.                        */}
      <div aria-hidden className="absolute inset-0 z-0 pointer-events-none">
        <NodeCanvas textureRef={hlsTexture} opacityRef={videoOpacity} />
      </div>

      {/* ── Full-height flex shell — vertically centres content ───────────
          px-4 md:px-12 matches the Vercel/Linear horizontal rhythm.       */}
      <div className="relative z-10 h-full flex flex-col justify-center px-4 md:px-12">

        {/* max-w-6xl keeps the layout from stretching on ultra-wides */}
        <div className="mx-auto w-full max-w-6xl flex flex-col gap-10">

          {/* ── Heading block ─────────────────────────────────────────────
              id="nodes-heading" — GSAP targets direct children (`> *`) for
              individual stagger.  Plain semantic elements; no framer-motion. */}
          <div id="nodes-heading" className="flex flex-col gap-3 max-w-2xl">
            <span className="text-[11px] tracking-[0.32em] uppercase text-white/45 font-mono">
              02 — Global Nodes
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.08] text-white">
              Three cities, one live mesh.
            </h2>
            <p className="text-base sm:text-lg text-white/65 leading-relaxed">
              ARGOS runs as a tri-region mesh. Requests land at the nearest
              node, render jobs split across the fleet, and orchestrator state
              replicates every 200 ms.
            </p>
          </div>

          {/* ── City cards ────────────────────────────────────────────────
              lg:grid-cols-3 — single column on mobile, three on desktop.
              gap-6 gives breathing room without stretching past the 100vh
              boundary on standard 768 px-tall laptops.
              NO <Reveal> wrapper — GSAP owns the entrance via .node-card.
              SpotlightCard still supplies the glass + cursor-spotlight.    */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
            {NODES.map((n) => (
              <SpotlightCard
                key={n.code}
                spotlightColor="rgba(0, 229, 255, 0.22)"
                // node-card — GSAP selector target for stagger entrance
                className="node-card rounded-2xl p-6 flex flex-col gap-4"
              >
                <header className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="relative inline-flex h-2 w-2">
                      <span className="absolute inset-0 rounded-full bg-emerald-400/70 animate-ping" />
                      <span className="relative inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    </span>
                    <span className="text-[11px] tracking-[0.28em] uppercase text-emerald-300/85 font-mono">
                      Online
                    </span>
                  </div>
                  <span className="text-[11px] tracking-[0.28em] uppercase text-white/40 font-mono">
                    {n.code}
                  </span>
                </header>

                <div>
                  <h3 className="text-xl font-semibold text-white tracking-tight">
                    {n.city}
                  </h3>
                  <p className="text-xs text-white/45 font-mono mt-1">{n.coords}</p>
                </div>

                <div className="mt-1 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] tracking-[0.32em] uppercase text-white/40 font-mono">
                      H200
                    </div>
                    <div className="text-lg font-semibold text-white tabular-nums mt-0.5">
                      {n.h200}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-[0.32em] uppercase text-white/40 font-mono">
                      Role
                    </div>
                    <div className="text-sm text-white/80 mt-0.5">{n.role}</div>
                  </div>
                </div>
              </SpotlightCard>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
