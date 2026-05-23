"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";

/**
 * OGL is not SSR-safe (references WebGL context at module level on some
 * bundlers). Load client-side only via dynamic import with ssr: false.
 */
const Orb = dynamic(() => import("@/ui/orb/Orb"), { ssr: false });

function ArrowUpRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

const EASE = [0.16, 1, 0.3, 1] as const;
const SPRING = { type: "spring", stiffness: 380, damping: 24, mass: 0.6 } as const;

/**
 * Hero section — three visual layers:
 *
 *   z-0  OGL Orb (#orb-bg)
 *        Constantly undulating purple/cyan shader orb that acts as the
 *        initial hero background. `forceHoverState + rotateOnHover` keep it
 *        alive without mouse interaction. GSAP ScrollController dissolves it
 *        (scale→3, blur→20px, opacity→0) as the user scrolls, cross-fading
 *        into the Three.js particle canvas (#three-scene, fixed inset-0).
 *
 *   z-10 DOM UI (#hero-ui)
 *        Badge, headline, subtext, CTA buttons — staggered entry via
 *        framer-motion initial/animate. GSAP ScrollController animates this
 *        out (y: 0→-100, opacity: 1→0) during the first 30% of scroll.
 */
export function Hero() {
  return (
    <section
      id="platform"
      className="relative w-full min-h-screen overflow-hidden"
    >
      {/* ── OGL Orb background ─────────────────────────────────────────────
          Fills the section. GSAP Phase 2 will scale/blur/fade this out
          as the Three.js particle canvas fades in beneath it. */}
      <div
        id="orb-bg"
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ transformOrigin: "50% 50%" }}
      >
        <Orb
          hue={0}
          backgroundColor="#000000"
        />
      </div>

      {/* ── DOM UI ──────────────────────────────────────────────────────────
          GSAP Phase 1 targets this container id to lift/fade it out. */}
      <div
        id="hero-ui"
        className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center"
      >
        {/* Status badge */}
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: EASE, delay: 3.25 }}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-sm text-white/75">Now routing on H200 · v0.3 Pilot</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.1, ease: EASE, delay: 3.4 }}
          className="mt-7 max-w-4xl text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] text-white pointer-events-none"
        >
          Headless infrastructure
          <br />
          for AI-native commerce.
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: EASE, delay: 3.6 }}
          className="mt-6 max-w-xl text-base sm:text-lg text-white/70 leading-relaxed pointer-events-none"
        >
          Elite model routing on H200. Built for premium brands.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: EASE, delay: 3.8 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3 pointer-events-auto"
        >
          {/* Primary — solid white, Vercel/Linear convention */}
          <motion.a
            href="#access"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 font-medium text-white backdrop-blur-sm"
          >
            Request Pilot Access
            <ArrowUpRight />
          </motion.a>

          {/* Secondary — solid dark, subtle border */}
          <motion.a
            href="#whitepaper"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-medium text-white backdrop-blur-sm"
          >
            Read the whitepaper
          </motion.a>
        </motion.div>

        {/* City footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, ease: EASE, delay: 4.05 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] tracking-[0.32em] uppercase text-white/45 pointer-events-none font-mono"
        >
          <span>LOS ANGELES</span>
          <span className="opacity-50">·</span>
          <span>TORONTO</span>
          <span className="opacity-50">·</span>
          <span>SHEFFIELD</span>
        </motion.div>
      </div>

      {/* Scroll affordance — sits outside #hero-ui so it stays visible
          slightly longer as the UI content lifts out */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: EASE, delay: 4.2 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
      >
        <div className="flex flex-col items-center gap-2 text-[10px] tracking-[0.32em] uppercase text-white/35 font-mono">
          <span>Scroll</span>
          <span className="block h-6 w-px bg-gradient-to-b from-white/40 to-transparent" />
        </div>
      </motion.div>
    </section>
  );
}
