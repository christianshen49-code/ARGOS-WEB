"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Scroll-driven bridge that visually hands off the Hero (cyan orb residual)
 * into the Pillars (magenta aurora). Renders at the top of the Pillars
 * section, on top of the standard SectionTransition.
 *
 * Three scroll-linked elements, all driven by the user crossing the seam:
 *
 *   1. A vertical magenta column that wells up at the seam — opacity and
 *      scaleY grow as scroll progress enters the section.
 *   2. A wide horizontal "light streak" that sweeps across the entire
 *      viewport at the exact instant the section enters the viewport.
 *      Travels left → right keyed to scroll progress 0 → 0.18.
 *   3. A magenta bloom that pulses brighter as the user passes the seam.
 *
 * All effects fade out by the time scroll progress reaches ~0.25, so the
 * bridge clears for the Pillars content underneath.
 */
export function AuroraBridge() {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start center"],
  });

  // Sweep: -110% → 110% across the viewport as scroll progress 0 → 1.
  const sweepX = useTransform(scrollYProgress, [0, 1], ["-110%", "110%"]);
  const sweepOpacity = useTransform(
    scrollYProgress,
    [0, 0.15, 0.55, 1],
    [0, 1, 0.6, 0],
  );

  // Magenta column rising from the seam.
  const columnScaleY = useTransform(scrollYProgress, [0, 1], [0.4, 1.4]);
  const columnOpacity = useTransform(
    scrollYProgress,
    [0, 0.35, 0.8, 1],
    [0, 1, 0.7, 0],
  );

  // Central bloom that intensifies at mid-cross then fades.
  const bloomOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0.4]);
  const bloomScale = useTransform(scrollYProgress, [0, 1], [0.8, 1.3]);

  return (
    <div
      ref={ref}
      className="absolute inset-x-0 top-0 h-44 pointer-events-none z-[2]"
      aria-hidden
    >
      {/* Horizontal sweep — a thin streak that travels across the seam. */}
      <motion.div
        style={{ x: sweepX, opacity: sweepOpacity }}
        className="absolute top-0 left-0 right-0 h-px"
      >
        <div className="h-px w-[60%] bg-gradient-to-r from-transparent via-[#e100ff] to-transparent shadow-[0_0_30px_rgba(225,0,255,0.9),0_0_70px_rgba(225,0,255,0.5)]" />
      </motion.div>

      {/* Magenta column — vertical bloom rising at the seam center. */}
      <motion.div
        style={{
          scaleY: columnScaleY,
          opacity: columnOpacity,
          transformOrigin: "50% 0%",
          background:
            "radial-gradient(80% 100% at 50% 0%, rgba(225,0,255,0.55) 0%, rgba(225,0,255,0.18) 25%, transparent 70%)",
          willChange: "transform, opacity",
        }}
        className="absolute left-1/2 -translate-x-1/2 top-0 w-[95vw] max-w-[1200px] h-44"
      />

      {/* Cyan→magenta crossfade bloom — a wide soft halo that picks up the
          Hero's cyan and bleeds into the aurora's magenta as the user
          crosses the seam. */}
      <motion.div
        style={{
          scale: bloomScale,
          opacity: bloomOpacity,
          background:
            "radial-gradient(60% 80% at 50% 0%, rgba(100,206,251,0.18) 0%, rgba(225,0,255,0.28) 35%, transparent 70%)",
          willChange: "transform, opacity",
        }}
        className="absolute left-1/2 -translate-x-1/2 top-0 w-[70vw] max-w-[900px] h-40 mix-blend-screen"
      />
    </div>
  );
}
