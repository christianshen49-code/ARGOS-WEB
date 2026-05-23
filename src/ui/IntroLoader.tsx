"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

/**
 * 1.2-second entrance sequence — the ARGOS wordmark masks in letter-by-
 * letter, holds a beat, then sweeps out as the loader plate fades to
 * transparent. After the timeline completes the component unmounts, so it
 * imposes zero render cost during normal scroll.
 *
 * GSAP timeline owns all timing; pointer-events are disabled throughout
 * so the loader never traps clicks.
 */
export function IntroLoader() {
  const wrap = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const letters = el.querySelectorAll(".intro-letter");

    gsap.set(letters, { yPercent: 120, opacity: 0 });

    const tl = gsap.timeline({
      onComplete: () => setDone(true),
    });

    tl.to(letters, {
      yPercent: 0,
      opacity: 1,
      duration: 0.7,
      ease: "expo.out",
      stagger: 0.06,
    })
      .to({}, { duration: 0.25 }) // hold
      .to(
        letters,
        {
          yPercent: -110,
          opacity: 0,
          duration: 0.55,
          ease: "expo.in",
          stagger: 0.04,
        },
        ">",
      )
      .to(
        el,
        { autoAlpha: 0, duration: 0.5, ease: "power2.out" },
        "-=0.35",
      );

    return () => {
      tl.kill();
    };
  }, []);

  if (done) return null;

  return (
    <div className="intro-loader" ref={wrap} aria-hidden>
      <div className="intro-wordmark">
        {"ARGOS".split("").map((c, i) => (
          <span key={i} className="intro-letter-mask">
            <span className="intro-letter">{c}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
