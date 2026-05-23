/**
 * pageTransition — imperative singleton that decouples link components from
 * the GSAP overlay component.
 *
 * Usage:
 *   • PageTransitionOverlay calls pageTransition.register(fn) on mount to
 *     install its GSAP-driven warp handler.
 *   • TransitionLink (and any other nav component) calls
 *     pageTransition.navigate(href) to trigger the full sequence.
 *
 * Falls back to a direct location change if the overlay hasn't mounted yet
 * (e.g. SSR or extremely early clicks).
 */
type Handler = (href: string) => void;

let _handler: Handler = (href: string) => {
  if (typeof window !== "undefined") window.location.href = href;
};

export const pageTransition = {
  /** Called by PageTransitionOverlay on mount. */
  register(fn: Handler) {
    _handler = fn;
  },
  /** Called by any link that wants an animated route change. */
  navigate(href: string) {
    _handler(href);
  },
};
