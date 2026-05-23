"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { motion, type Variants } from "framer-motion";

// expo.out approximation as a cubic-bezier — near-vertical tail-end
// deceleration gives the cards real "settle" weight at the end of the move.
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Cinematic card entrance — heavy, weighted, exponential ease.
 *
 * Per spec:
 *   start  →  y: 150, rotateX: 15deg, opacity: 0, filter: blur(20px)
 *   end    →  y: 0,   rotateX: 0,     opacity: 1, filter: blur(0px)
 *   ease: expo.out, duration: 1.5s, stagger via parent Reveal
 *
 * The big translateY + rotateX combo gives the cards real physical weight —
 * they feel like they're being placed onto an invisible surface from above,
 * not just sliding in. expo.out's near-vertical tail nails the cinematic
 * "settle" beat where the cards visibly decelerate at the end.
 */
const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 150,
    rotateX: 15,
    scale: 0.96,
    filter: "blur(20px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    filter: "blur(0px)",
  },
};

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  /** Radial-gradient color for the cursor-tracking spotlight. */
  spotlightColor?: string;
  /** Override the entrance animation duration. */
  duration?: number;
  /** Render as a specific tag. Defaults to <article>. */
  as?: "article" | "div" | "section" | "li";
}

/**
 * Glass + spotlight card. Stacks three visual layers:
 *
 *   1. `.glass`         — Apple Liquid Glass (background blur, border
 *                         refraction via ::before, top bloom via ::after,
 *                         inset specular highlights).
 *   2. `.spotlight-glow` — a radial-gradient overlay positioned at the
 *                         cursor (via --mouse-x / --mouse-y CSS vars
 *                         written on every mousemove). Fades in on hover,
 *                         mix-blend-mode: screen so the color brightens
 *                         the underlying glass tint.
 *   3. children         — actual card content at z-index 2 (sits above
 *                         all the decorative layers).
 *
 * Also drops in via the same fadeUp variants as RevealItem so it can be
 * placed inside a <Reveal> wrapper and stagger with siblings.
 */
export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(255, 255, 255, 0.22)",
  duration = 1.5,
  as = "article",
}: SpotlightCardProps) {
  const ref = useRef<HTMLElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    el.style.setProperty("--spotlight-color", spotlightColor);
  };

  const MotionTag = motion[as];

  return (
    <MotionTag
      ref={ref as never}
      variants={fadeUp}
      transition={{ duration, ease: EASE }}
      style={{ transformOrigin: "50% 0%", transformStyle: "preserve-3d" }}
      onMouseMove={handleMouseMove}
      className={`glass glass-card spotlight-host ${className}`}
    >
      <span className="spotlight-glow" aria-hidden />
      {children}
    </MotionTag>
  );
}
