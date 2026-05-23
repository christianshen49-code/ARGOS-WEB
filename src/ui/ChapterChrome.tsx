"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { choreo } from "@/canvas/choreography";

const CHAPTERS = [
  { id: 0, label: "HERO" },
  { id: 1, label: "GLOBAL NODES" },
] as const;

/**
 * Pinned top-right chapter indicator.
 *
 * Watches the choreography singleton each frame; when `heroDissolve` crosses
 * 0.5 the active chapter switches and GSAP crossfades the opacity of the two
 * label rows.
 */
export function ChapterChrome() {
  const refs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    let active = 0;
    let raf = 0;

    if (refs.current[0]) gsap.set(refs.current[0], { opacity: 1 });
    if (refs.current[1]) gsap.set(refs.current[1], { opacity: 0.35 });

    const tick = () => {
      const target = choreo.heroDissolve > 0.5 ? 1 : 0;
      if (target !== active) {
        const out = refs.current[active];
        const into = refs.current[target];
        if (out) gsap.to(out, { opacity: 0.35, duration: 0.4, ease: "power2.out" });
        if (into) gsap.to(into, { opacity: 1, duration: 0.4, ease: "power2.out" });
        active = target;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <ul className="chapter-chrome" aria-hidden>
      {CHAPTERS.map((c, i) => (
        <li
          key={c.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <span className="chapter-num">{String(c.id + 1).padStart(2, "0")}</span>
          <span className="chapter-label">{c.label}</span>
        </li>
      ))}
    </ul>
  );
}
