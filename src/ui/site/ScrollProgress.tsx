"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/**
 * Thin top-of-viewport bar that fills as the user scrolls. Spring-smoothed so
 * the line glides instead of snapping with the raw scroll value.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 24,
    mass: 0.4,
  });

  return (
    <motion.div
      style={{ scaleX, transformOrigin: "0% 50%" }}
      className="fixed top-0 left-0 right-0 h-[2px] z-50 bg-gradient-to-r from-white/60 via-white/40 to-white/10 pointer-events-none"
      aria-hidden
    />
  );
}
