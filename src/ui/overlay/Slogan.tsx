"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const SLOGAN = "Orchestrating elite compute, delivering exponential growth.";

/**
 * Character-level reveal of the hero slogan.
 *
 *   • Words preserve `white-space: nowrap`, so line breaks only occur on
 *     spaces — never mid-word.
 *   • Each visible character is wrapped in an `overflow: hidden` mask so
 *     the GSAP `yPercent: 100 → 0` slide reads as a clean reveal.
 *   • Bound to a ScrollTrigger on the slogan itself with
 *     `toggleActions: 'play none none reverse'` so it plays on enter and
 *     reverses on exit — replay works without page reload.
 */
export function Slogan() {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chars = el.querySelectorAll<HTMLSpanElement>(".slogan-char");

    gsap.set(chars, { yPercent: 110 });

    const tween = gsap.to(chars, {
      yPercent: 0,
      duration: 0.85,
      ease: "expo.out",
      stagger: { each: 0.018, from: "start" },
      scrollTrigger: {
        trigger: el,
        start: "top 78%",
        toggleActions: "play none none reverse",
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  const words = SLOGAN.split(" ");

  return (
    <h1 className="hero-slogan" ref={ref} aria-label={SLOGAN}>
      {words.map((word, wi) => (
        <span key={wi} className="slogan-word">
          {word.split("").map((ch, ci) => (
            <span key={ci} className="slogan-char-mask">
              <span className="slogan-char">{ch}</span>
            </span>
          ))}
          {wi < words.length - 1 ? " " : ""}
        </span>
      ))}
    </h1>
  );
}
