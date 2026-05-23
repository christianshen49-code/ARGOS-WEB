import { create } from "zustand";

export type RoutePhase = "hero" | "platform" | "nodes" | "pricing";

interface ArgosState {
  /** Normalised cursor position, range [-1, 1] on both axes (y up). */
  cursor: { x: number; y: number };
  /** Smoothed cursor speed, normalised to roughly [0, 1]. */
  velocity: number;
  /** Active section — drives WebGL camera rig + shader transitions. */
  routePhase: RoutePhase;
  /** Document scroll progress, range [0, 1]. Driven by Lenis. */
  scrollProgress: number;

  setCursor: (x: number, y: number) => void;
  setVelocity: (v: number) => void;
  setRoutePhase: (phase: RoutePhase) => void;
  setScrollProgress: (p: number) => void;
}

export const useArgosStore = create<ArgosState>((set) => ({
  cursor: { x: 0, y: 0 },
  velocity: 0,
  routePhase: "hero",
  scrollProgress: 0,

  setCursor: (x, y) => set({ cursor: { x, y } }),
  setVelocity: (velocity) => set({ velocity }),
  setRoutePhase: (routePhase) => set({ routePhase }),
  setScrollProgress: (scrollProgress) => set({ scrollProgress }),
}));
