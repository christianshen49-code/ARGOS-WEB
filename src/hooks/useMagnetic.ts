"use client";

import { useRef } from "react";
import { useSpring, type SpringOptions } from "framer-motion";

const SPRING: SpringOptions = { stiffness: 160, damping: 14, mass: 0.35 };

/**
 * Magnetic-hover physics for interactive elements. While the pointer is within
 * `radius` of the element centre, the element is drawn toward the cursor by
 * `strength`; a spring returns it to rest on leave.
 */
export function useMagnetic(strength = 0.45, radius = 140) {
  const ref = useRef<HTMLElement | null>(null);
  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);

  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < radius) {
      x.set(dx * strength);
      y.set(dy * strength);
    }
  };

  const onPointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  return { ref, x, y, onPointerMove, onPointerLeave };
}
