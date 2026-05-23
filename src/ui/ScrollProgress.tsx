"use client";

import { useEffect, useRef } from "react";
import { useArgosStore } from "@/store/useArgosStore";

const R = 11;
const CIRC = 2 * Math.PI * R;

/**
 * Bottom-right SVG ring whose stroke-dashoffset is driven each frame by
 * `scrollProgress` (set by Lenis via the smooth-scroll bridge). The accent
 * arc sweeps clockwise from the 12-o'clock position as the user scrolls.
 */
export function ScrollProgress() {
  const ringRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = useArgosStore.getState().scrollProgress;
      if (ringRef.current) {
        ringRef.current.style.strokeDashoffset = String((1 - p) * CIRC);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="scroll-progress" aria-hidden>
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle
          cx="14"
          cy="14"
          r={R}
          stroke="rgba(232,238,249,0.18)"
          strokeWidth="1.5"
          fill="none"
        />
        <circle
          ref={ringRef}
          cx="14"
          cy="14"
          r={R}
          stroke="#16f0c8"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC}
          transform="rotate(-90 14 14)"
          strokeLinecap="round"
        />
      </svg>
      <span>SCROLL</span>
    </div>
  );
}
