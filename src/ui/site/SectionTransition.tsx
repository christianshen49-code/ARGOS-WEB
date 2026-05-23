"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Smooth handoff between dark sections. Three layered effects:
 *
 *  1. Top "ink fade" — a tall gradient at the section's top that fades
 *     transparent → black, blending the previous section's bleed into the
 *     new background.
 *  2. Center bloom — a soft radial spot at the very top, scaled by scroll
 *     progress, that reads as the previous section's light spilling in.
 *  3. Divider line — a thin gradient hairline that scaleX-reveals as you
 *     enter the section.
 */
export function SectionTransition({
  tint = "rgba(156, 100, 255, 0.18)",
}: {
  /** Color of the light spillover bloom at the section seam. */
  tint?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Bloom grows from 0 → 1.1 as the seam approaches, then fades.
  const bloomScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.6, 1.15, 0.7]);
  const bloomOpacity = useTransform(scrollYProgress, [0, 0.4, 0.7, 1], [0, 1, 1, 0]);

  return (
    <div ref={ref} className="absolute inset-x-0 top-0 h-40 pointer-events-none">
      {/* Layer 1 — ink fade (transparent at top → page bg at 80%) */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/95 via-black/60 to-transparent" />

      {/* Layer 2 — center bloom, scroll-driven */}
      <motion.div
        style={{
          scale: bloomScale,
          opacity: bloomOpacity,
          background: `radial-gradient(60% 100% at 50% 0%, ${tint} 0%, transparent 70%)`,
          willChange: "transform, opacity",
        }}
        className="absolute left-1/2 -translate-x-1/2 top-0 w-[90vw] max-w-[1100px] h-48"
      />

      {/* Layer 3 — divider hairline, viewport-revealed */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        whileInView={{ scaleX: 1, opacity: 1 }}
        viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
        transition={{ duration: 1.3, ease: EASE }}
        style={{ transformOrigin: "50% 50%" }}
        className="absolute left-1/2 -translate-x-1/2 top-0 w-full max-w-6xl h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />
    </div>
  );
}
