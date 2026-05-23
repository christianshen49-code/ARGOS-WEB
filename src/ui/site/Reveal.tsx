"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * "Page-turn" entrance — combines fade-up with a tiny rotateX hinge from
 * the top edge, a brief blur, and a sub-1 scale. The composite reads as a
 * page lifting into view, not a generic slide.
 */
const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 32,
    rotateX: -8,
    scale: 0.98,
    filter: "blur(6px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    filter: "blur(0px)",
  },
};

interface RevealProps {
  children: ReactNode;
  /** Frames of delay between staggered children, in seconds. */
  stagger?: number;
  /** Initial delay before the first child animates. */
  delay?: number;
  className?: string;
  /** Render as a different element. */
  as?: "div" | "section" | "ul";
}

/**
 * Fades + lifts its direct children when scrolled into view. Children must
 * be wrapped in <RevealItem/> to receive the staggered motion. Plays once.
 */
export function Reveal({
  children,
  stagger = 0.08,
  delay = 0,
  className = "",
  as = "div",
}: RevealProps) {
  const MotionTag = motion[as];
  return (
    <MotionTag
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-15% 0px -10% 0px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
      style={{ perspective: "1200px" }}
      className={className}
    >
      {children}
    </MotionTag>
  );
}

interface RevealItemProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "h2" | "h3" | "p" | "span" | "li" | "article";
  duration?: number;
}

export function RevealItem({
  children,
  className = "",
  as = "div",
  duration = 0.95,
}: RevealItemProps) {
  const MotionTag = motion[as];
  return (
    <MotionTag
      variants={fadeUp}
      transition={{ duration, ease: EASE }}
      style={{ transformOrigin: "50% 0%", transformStyle: "preserve-3d" }}
      className={className}
    >
      {children}
    </MotionTag>
  );
}
