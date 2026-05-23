"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { choreo } from "./choreography";

gsap.registerPlugin(ScrollTrigger);

/**
 * Sets up the GSAP timeline that scrubs the {@link choreo} singleton against
 * scroll position. ScrollTrigger pins the `.hero` element for an extra 200%
 * of scroll length while the timeline plays through three phases:
 *
 *   • Phase 1 (0 → 0.3): subtle lean — hero scales up 6%, dissolve whispers
 *     to ~10%. Reads as "the camera leans in."
 *   • Phase 2 (0.3 → 0.7): the transition — hero dissolves fully via the
 *     shader's noise-edge erosion, globe rides forward from z=-14 to z=0
 *     and scales to full size, arc geometry draws in via drawRange.
 *   • Phase 3 (0.7 → 1.0): orbit — camera yaws ~16° around the globe.
 */
export function ScrollChoreography() {
  useEffect(() => {
    // Reset the singleton on (re)mount in case HMR left it mid-animation.
    choreo.heroScale = 1.0;
    choreo.heroDissolve = 0.0;
    choreo.globeZ = -14.0;
    choreo.globeScale = 0.7;
    choreo.camYaw = 0.0;
    choreo.arcDrawn = 0.0;

    // Wait for DOM layout — Lenis + ScrollTrigger need the section heights
    // to be in place before they measure trigger boundaries.
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "+=200%",
        scrub: 1,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
      },
    });

    tl.to(choreo, {
      heroScale: 1.06,
      heroDissolve: 0.10,
      duration: 0.3,
    });

    tl.to(
      choreo,
      {
        heroDissolve: 1.0,
        globeZ: 0,
        globeScale: 1.0,
        arcDrawn: 1.0,
        duration: 0.4,
      },
      ">",
    );

    tl.to(choreo, { camYaw: 0.28, duration: 0.3 }, ">");

    // Recalibrate on resize — Lenis + ScrollTrigger interplay needs this.
    const onResize = () => ScrollTrigger.refresh();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  return null;
}
