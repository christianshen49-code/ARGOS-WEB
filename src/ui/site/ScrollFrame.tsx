"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

interface ScrollFrameProps {
  children: ReactNode;
  className?: string;
  /** Strength of the scroll camera. 0 disables; 1 is the default. */
  intensity?: number;
}

/**
 * Cinematic scroll camera for section content.
 *
 * Tracks the wrapped element's progress through the viewport via
 * `useScroll({ offset: ["start end", "end start"] })`, then maps that
 * 0 → 1 progress through four transforms that compose into a "camera
 * dollying through" feel:
 *
 *   ┌─────────────┬──────────┬──────────┬──────────┐
 *   │ progress    │  enter   │  visible │  leave   │
 *   ├─────────────┼──────────┼──────────┼──────────┤
 *   │ scale       │  0.94 →  │   1.0    │   → 0.97 │   camera depth
 *   │ opacity     │  0.15 →  │   1.0    │   → 0.45 │   fade in/out
 *   │ y           │  +50 →   │   0      │   → -50  │   parallax drift
 *   │ filter blur │  2.5px → │   0      │   → 1.5  │   focus
 *   └─────────────┴──────────┴──────────┴──────────┘
 *
 * The raw scrollYProgress is spring-smoothed before driving the transforms
 * so the motion has natural momentum even with Lenis already easing the
 * scroll input. Combined effect: section content feels like it's being
 * filmed by a slow-moving camera, not snapped into place.
 *
 * Inspired by ActiveTheory's continuous-flow scroll narrative.
 */
export function ScrollFrame({
  children,
  className = "",
  intensity = 1,
}: ScrollFrameProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const progress = useSpring(scrollYProgress, {
    stiffness: 130,
    damping: 26,
    mass: 0.5,
  });

  // Intensity scales the deflection amounts. At intensity 0, everything is
  // identity; at 1, the transforms reach the values shown in the table above.
  const minScale = 1 - 0.06 * intensity;
  const exitScale = 1 - 0.03 * intensity;
  const enterY = 50 * intensity;
  const exitY = -50 * intensity;
  const minOpacity = 0.15 + 0.15 * (1 - intensity);
  const exitOpacity = 0.45 + 0.15 * (1 - intensity);

  const scale = useTransform(
    progress,
    [0, 0.25, 0.75, 1],
    [minScale, 1, 1, exitScale],
  );
  const opacity = useTransform(
    progress,
    [0, 0.2, 0.8, 1],
    [minOpacity, 1, 1, exitOpacity],
  );
  const y = useTransform(progress, [0, 0.3, 0.7, 1], [enterY, 0, 0, exitY]);
  const filter = useTransform(
    progress,
    [0, 0.2, 0.8, 1],
    ["blur(2.5px)", "blur(0px)", "blur(0px)", "blur(1.5px)"],
  );

  return (
    <motion.div
      ref={ref}
      style={{
        scale,
        opacity,
        y,
        filter,
        willChange: "transform, opacity, filter",
        transformOrigin: "50% 50%",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
