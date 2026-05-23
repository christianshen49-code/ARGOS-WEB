"use client";

import { useEffect, useRef } from "react";
import { useArgosStore } from "@/store/useArgosStore";

/**
 * Tracks the pointer at the window level (the canvas itself is pointer-events:none)
 * and feeds normalised position + a smoothed, decaying velocity into the global
 * store. Shaders read these as uniforms to drive fluid / aberration effects.
 */
export function useCursorVelocity() {
  const last = useRef({ x: 0, y: 0, t: 0 });

  useEffect(() => {
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -((e.clientY / window.innerHeight) * 2 - 1);

      const dt = Math.max(now - last.current.t, 16) / 1000;
      const dx = nx - last.current.x;
      const dy = ny - last.current.y;
      // Raw speed clamped, then normalised into [0, 1].
      const speed = Math.min(Math.hypot(dx, dy) / dt, 6) / 6;

      last.current = { x: nx, y: ny, t: now };

      const s = useArgosStore.getState();
      s.setCursor(nx, ny);
      s.setVelocity(Math.max(speed, s.velocity));
    };

    // Continuous velocity decay so effects ease back to rest.
    const decay = () => {
      const s = useArgosStore.getState();
      if (s.velocity > 0.001) s.setVelocity(s.velocity * 0.92);
      raf = requestAnimationFrame(decay);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(decay);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
}
