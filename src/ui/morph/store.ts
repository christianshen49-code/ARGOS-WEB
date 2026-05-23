"use client";

import { create } from "zustand";

/**
 * Scroll state shared between Lenis, GSAP ScrollTrigger, and the WebGL
 * canvas. Reads inside `useFrame` use `scrollStore.getState()` — never the
 * React hook — so updates never trigger a re-render of any component.
 * This is the canonical "ref-store" pattern for 60fps render loops.
 *
 *   scrollState — continuous morph state (0.0 → 3.0) across all four sections.
 *                 0 = Orb  ·  1 = DataHorizon  ·  2 = NodeClusters  ·  3 = Abyss
 *                 Written by per-section GSAP ScrollTriggers; read inside
 *                 useFrame via scrollStore.getState() — zero React re-renders.
 *   velocity    — raw Lenis scroll velocity (px/frame), updated every scroll
 *                 event. Consumers smooth/clamp as appropriate.
 *   isPricing   — true while the /pricing route is active. Signals WebGL to
 *                 enter ambient mode: 50 % slower particles, reduced bloom,
 *                 camera pinned to node-cluster vantage. Written by RouteSync;
 *                 read inside useFrame — zero React re-renders.
 */
interface ScrollState {
  scrollState: number;
  velocity: number;
  isPricing: boolean;
  /**
   * Flips true once — when IntroCurtain reaches phase "gone" (~4.5 s after
   * first paint).  GlobalScrollSync subscribes and calls ScrollTrigger.refresh()
   * + cacheBoundaries() at that moment so section offsets are read from a fully
   * laid-out, paint-stable DOM.  Stays true for all subsequent navigations so
   * route-change boundary caching is never gated behind this flag.
   */
  isPreloaderComplete: boolean;
}

export const scrollStore = create<ScrollState>(() => ({
  scrollState: 0,
  velocity: 0,
  isPricing: false,
  isPreloaderComplete: false,
}));
