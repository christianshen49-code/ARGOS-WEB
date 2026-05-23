"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useArgosStore } from "@/store/useArgosStore";

gsap.registerPlugin(ScrollTrigger);

/**
 * Mounts Lenis inertial scrolling on the document, bridges its scroll events
 * to the zustand store as a normalised `scrollProgress` (0–1) and keeps GSAP
 * ScrollTrigger ticking against Lenis' rAF.
 *
 * Lives once in the root layout; renders nothing.
 */
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
    });

    const onScroll = (e: { scroll: number; limit: number }) => {
      const p = e.limit > 0 ? Math.min(Math.max(e.scroll / e.limit, 0), 1) : 0;
      useArgosStore.getState().setScrollProgress(p);
      ScrollTrigger.update();
    };
    lenis.on("scroll", onScroll);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
