"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

interface GlassButtonProps extends Omit<HTMLMotionProps<"a">, "ref"> {
  href: string;
  /** Render with the stronger primary-CTA tint. */
  primary?: boolean;
  /** Defaults to "xl" radius. Pass "full" for pill. */
  radius?: "xl" | "2xl" | "full";
  /** Defaults to "md" padding. */
  size?: "sm" | "md" | "lg";
  /** Disable the magnetic hover (e.g. on touch devices, or nav links). */
  magnetic?: boolean;
  /** Strength of the magnetic pull, 0 → 1. */
  magneticStrength?: number;
  children: ReactNode;
  className?: string;
}

const SPRING = { type: "spring", stiffness: 380, damping: 24, mass: 0.6 } as const;

const sizeMap = {
  sm: "px-4 py-1.5 text-sm",
  md: "px-5 py-3 text-sm",
  lg: "px-6 py-3 text-sm sm:text-base",
};

const radiusMap = {
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

/**
 * Glass CTA — three layered hover behaviours:
 *
 *   1. Framer-motion `whileHover` lifts + scales the whole element
 *      (composes additively with the GSAP magnetic offset below).
 *   2. GSAP-driven *magnetic* pull — pointermove inside the button's
 *      bounding rect drags the element toward the cursor (strength
 *      configurable, default 0.4). Pointer-leave springs it back with
 *      `elastic.out` for that signature settle. This is the bit that
 *      separates a premium agency button from a stock one.
 *   3. CSS shine sweep via `.shine-layer` (defined in globals.css) that
 *      diagonally travels across on `:hover`.
 *
 * The magnetic transform is applied via inline GSAP — bypassing React's
 * render path entirely, so 60fps even mid-scroll.
 */
export function GlassButton({
  href,
  primary = false,
  radius = "xl",
  size = "md",
  magnetic = true,
  magneticStrength = 0.4,
  children,
  className = "",
  ...rest
}: GlassButtonProps) {
  const anchorRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!magnetic) return;
    const el = anchorRef.current;
    if (!el) return;

    // Skip magnetic on touch — pointermove is unreliable, and the effect
    // is meaningless without a precise cursor anyway.
    const isTouch = window.matchMedia("(hover: none)").matches;
    if (isTouch) return;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      gsap.to(el, {
        x: dx * magneticStrength,
        y: dy * magneticStrength,
        duration: 0.55,
        ease: "power3.out",
        overwrite: "auto",
      });
    };

    const onLeave = () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.85,
        ease: "elastic.out(1, 0.5)",
        overwrite: "auto",
      });
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      gsap.killTweensOf(el);
    };
  }, [magnetic, magneticStrength]);

  const base =
    "shine-on-hover relative overflow-hidden inline-flex items-center justify-center gap-2 font-medium text-white";

  return (
    <motion.a
      ref={anchorRef}
      href={href}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      transition={SPRING}
      className={`${base} ${radiusMap[radius]} ${sizeMap[size]} glass ${primary ? "glass-strong" : ""} ${className}`}
      {...rest}
    >
      <span className="shine-layer" aria-hidden />
      <span className="relative z-[2] inline-flex items-center gap-2">{children}</span>
    </motion.a>
  );
}
