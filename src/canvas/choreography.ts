/**
 * Singleton mutable state for the scroll-driven choreography.
 *
 * GSAP ScrollTrigger animates these values; R3F `useFrame` reads them. The
 * proxy is kept OUT of zustand on purpose — zustand's `set()` creates a new
 * state object on every call, which would orphan GSAP's tween target.
 * A module-scoped singleton stays referentially stable, so GSAP and useFrame
 * always see the same numbers.
 *
 * Defaults match the "rest" state (scroll position = 0).
 */
export const choreo = {
  /** Hero plane group scale — pushes 1.0 → 1.06 in phase 1 for a subtle lean. */
  heroScale: 1.0,
  /** Hero shader dissolve threshold — 0 (intact) → 1 (fully eroded). */
  heroDissolve: 0.0,
  /** Globe group z position — recedes at -14, advances to 0 over phase 2. */
  globeZ: -14.0,
  /** Globe group scale — small at rest, full size at end of phase 2. */
  globeScale: 0.7,
  /** Camera yaw in radians around the origin — phase 3 only. */
  camYaw: 0.0,
  /** Fraction of arcs drawn on the globe (0 → 1 across phase 2). */
  arcDrawn: 0.0,
};
