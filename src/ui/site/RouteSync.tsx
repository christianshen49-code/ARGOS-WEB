"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { scrollStore } from "@/ui/morph/store";

/**
 * RouteSync — mounts in layout.tsx so it runs on every route.
 *
 * WebGL state machine:
 *
 *   "/"              isPricing=false
 *                    If returning from a secondary route: GSAP-tween scrollState
 *                    from 2.0 (the ambient pin value) → 0 over 1.2 s (Task 3:
 *                    fluid morph back to Hero Orb). Canvas stays at opacity:1 so
 *                    the user sees the particles reform. SmoothScroll's own
 *                    ScrollTrigger takes over as soon as the user starts scrolling.
 *
 *   "/pricing"       isPricing=true, fade #three-scene to opacity:1
 *   "/contact"       isPricing=true, fade #three-scene to opacity:1
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Bug fixes addressed:
 *
 * Bug 1 — Corrupted Hero Orb on return:
 *   isPricing pins the GLSL local `ss = 2.0`.  When it flips false the shader
 *   immediately reads the REAL scrollStore.scrollState, which is whatever the
 *   user had scrolled to before leaving (can be 0–3.0).  The snap to an
 *   unexpected scroll state causes the "grainy / shattered" artefact.
 *   Fix: on return, immediately write scrollState=2.0 to the store (matching
 *   the last visual state), then tween it to 0 so camera, particles, background
 *   and bloom all morph back in sync.
 *
 * Bug 2 — Canvas wrong opacity on return:
 *   On /pricing RouteSync sets #three-scene to opacity:1.  On return to / the
 *   ScrollController expects opacity to track the #platform scroll trigger.
 *   Because we leave opacity:1 (canvas visible), the GSAP scrub tween captures
 *   "from=1 → to=1" and becomes a no-op — canvas stays visible throughout,
 *   which is exactly right for the return journey.  No explicit reset is needed.
 */
export function RouteSync() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);

  // Proxy for GSAP to tween scrollState without triggering React renders.
  // Stable ref — GSAP holds a reference to this object between frames.
  const ssProxy = useRef({ value: 0 });

  useEffect(() => {
    const prev = prevPath.current;
    prevPath.current = pathname;

    // Always kill any in-flight restoration tween before deciding what to do next.
    gsap.killTweensOf(ssProxy.current);

    const isHome    = pathname === "/";
    const isAmbient = pathname === "/pricing" || pathname === "/contact";

    if (isAmbient) {
      // ── Secondary route: enter ambient WebGL mode ─────────────────────────
      // isPricing=true → OrbToWaveParticles pins ss=2.0 in GLSL, slows time 50%,
      // AdaptiveBloom drops to 1.2, CameraRig locks to node-cluster vantage.
      scrollStore.setState({ isPricing: true });

      // ScrollController is NOT mounted on these routes, so we fade the canvas
      // in ourselves. Short delay lets the warp overlay collapse first.
      gsap.to("#three-scene", {
        opacity: 1,
        duration: 0.9,
        delay: 0.15,
        ease: "power2.out",
      });

    } else if (isHome) {
      // ── Home route ────────────────────────────────────────────────────────

      if (prev !== null && prev !== "/") {
        // ── Returning from a secondary route ─────────────────────────────
        //
        // Step 1: flip isPricing off FIRST so the shader stops pinning ss=2.0
        //         and starts reading scrollState from the store.
        scrollStore.setState({ isPricing: false });

        // Step 2: immediately write scrollState=2.0 so the shader's first frame
        //         after the flip reads the SAME value it was visually showing
        //         (avoiding the instant snap to the stale stored value).
        ssProxy.current.value = 2.0;
        scrollStore.setState({ scrollState: 2.0 });

        // Step 3: GSAP tween 2.0 → 0 over 1.2 s (Task 3: fluid morph).
        //         Canvas is at opacity:1 so the user watches particles, camera
        //         and background all transition back to the Hero Orb state.
        //         SmoothScroll's trigger will override this the moment the
        //         user starts scrolling — that's the desired handoff.
        gsap.to(ssProxy.current, {
          value: 0,
          duration: 1.2,
          ease: "power2.inOut",
          overwrite: true,
          onUpdate: () => {
            scrollStore.setState({ scrollState: ssProxy.current.value });
          },
        });

      } else {
        // ── First load on "/" ─────────────────────────────────────────────
        // Scene.tsx initialises #three-scene at opacity:0.
        // ScrollController's Phase 3 trigger fades it in via scroll.
        // Store starts at its default { scrollState: 0, isPricing: false }.
        // Nothing to do — let SmoothScroll + ScrollController take over.
        scrollStore.setState({ isPricing: false });
      }
    }
  }, [pathname]);

  return null;
}
