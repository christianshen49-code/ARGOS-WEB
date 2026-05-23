"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Replaces the system cursor with a two-layer HUD reticle:
 *
 *   • 4 px white dot — instant tracking, mix-blend-difference for legibility
 *   • 28 px outlined ring — lerps toward the dot with a soft easing
 *
 * Any element decorated with `data-cursor-label="…"` triggers, on hover, the
 * ring to scale up and a small contextual label to slide in beneath it. GSAP
 * owns every transition; the body is set to `cursor: none` in globals.css.
 */
export function HudCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringWrapRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ringWrap = ringWrapRef.current;
    const ring = ringRef.current;
    const label = labelRef.current;
    if (!dot || !ringWrap || !ring || !label) return;

    const target = { x: -100, y: -100 };
    const trail = { x: -100, y: -100 };

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
    };

    let raf = 0;
    const tick = () => {
      trail.x += (target.x - trail.x) * 0.18;
      trail.y += (target.y - trail.y) * 0.18;
      ringWrap.style.transform = `translate3d(${trail.x}px, ${trail.y}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onOver = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const el = t && t.closest ? (t.closest("[data-cursor-label]") as HTMLElement | null) : null;
      if (el) {
        label.textContent = el.dataset.cursorLabel || "";
        gsap.to(ring, {
          scale: 2.2,
          borderColor: "rgba(232,238,249,0.85)",
          duration: 0.35,
          ease: "power2.out",
        });
        gsap.to(label, {
          opacity: 1,
          y: 0,
          duration: 0.3,
          ease: "power2.out",
        });
      }
    };

    const onOut = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const el = t && t.closest ? t.closest("[data-cursor-label]") : null;
      if (el) {
        gsap.to(ring, {
          scale: 1,
          borderColor: "rgba(232,238,249,0.35)",
          duration: 0.35,
          ease: "power2.out",
        });
        gsap.to(label, {
          opacity: 0,
          y: 8,
          duration: 0.25,
          ease: "power2.out",
        });
      }
    };

    gsap.set(label, { opacity: 0, y: 8 });

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: 4,
          height: 4,
          marginLeft: -2,
          marginTop: -2,
          background: "#e8eef9",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 9000,
          willChange: "transform",
          mixBlendMode: "difference",
        }}
      />
      <div
        ref={ringWrapRef}
        aria-hidden
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          pointerEvents: "none",
          zIndex: 9000,
          willChange: "transform",
          mixBlendMode: "difference",
        }}
      >
        <div
          ref={ringRef}
          style={{
            width: 28,
            height: 28,
            border: "1px solid rgba(232,238,249,0.35)",
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            transformOrigin: "center",
          }}
        />
        <span
          ref={labelRef}
          style={{
            position: "absolute",
            left: 0,
            top: "1.6em",
            transform: "translate(-50%, 0)",
            fontSize: "0.62rem",
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "#e8eef9",
            whiteSpace: "nowrap",
            fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
          }}
        />
      </div>
    </>
  );
}
