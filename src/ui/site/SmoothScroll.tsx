"use client";

/**
 * SmoothScroll — intentional no-op.
 *
 * Lenis creation, GSAP ticker wiring, and ScrollTrigger registration have
 * been consolidated into GlobalScrollSync (layout.tsx) so the scroll
 * pipeline survives route changes without being torn down and recreated.
 *
 * This shell is kept so page.tsx's existing import compiles without changes.
 */
export function SmoothScroll() {
  return null;
}
