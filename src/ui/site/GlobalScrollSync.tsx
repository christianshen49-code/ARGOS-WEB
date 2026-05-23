"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollStore } from "@/ui/morph/store";

/**
 * GlobalScrollSync — single source of truth for smooth scroll + WebGL state.
 *
 * Lives in layout.tsx so it NEVER unmounts across routes.
 *
 * Responsibilities:
 *   1. Creates a module-level Lenis singleton (once; _initialized guard
 *      prevents double-create under React StrictMode's double-invoke).
 *   2. Drives scrollStore.velocity + ScrollTrigger on every Lenis frame.
 *   3. Computes scrollState (0–3) via pure DOM arithmetic on every scroll
 *      tick — no ScrollTrigger callbacks that break when triggers are killed.
 *   4. On route change:
 *        · Scrolls to 0 immediately (Lenis + window fallback)
 *        · Kills all stale ScrollTriggers synchronously
 *        · Queues a rAF that runs AFTER the new page's own rAFs have
 *          registered fresh triggers → refresh + re-cache boundaries
 *
 * Ordering in layout.tsx: MUST appear before <RouteSync /> so sibling
 * useEffect hooks fire in declaration order (GlobalScrollSync → RouteSync).
 * This ensures lenis.scrollTo(0) fires while isPricing is still true,
 * keeping the scroll handler's early-exit active and leaving the
 * restoration tween (RouteSync) undisturbed.
 * ─────────────────────────────────────────────────────────────────────────
 * rAF ordering guarantee (children mount before parents in React):
 *   1. ScrollController.useEffect([]) queues   rAF-SC  → creates DOM triggers
 *   2. Nodes.useEffect([])          queues   rAF-N   → creates pin trigger
 *   3. GlobalScrollSync.useEffect([pathname]) queues rAF-G   → refresh + cache
 *
 *   killAll() fires synchronously in step (4 useEffect), BEFORE any rAF.
 *   New triggers (rAF-SC, rAF-N) therefore survive killAll. ✓
 *   refresh() fires in rAF-G, after all new triggers exist. ✓
 */

// ── Module-level singletons (outlive React component lifecycle) ───────────────
let _lenis:       Lenis | null = null;
let _initialized: boolean      = false;

interface Boundaries {
  /** scrollY where Orb→DataHorizon transition begins (platform centre @ viewport centre) */
  p0: number;
  /** scrollY where Orb→DataHorizon transition ends   (platform bottom @ viewport top)    */
  p1: number;
  /** scrollY where DataHorizon→NodeGroups begins     (#pillars top @ viewport top)        */
  q0: number;
  /** scrollY where DataHorizon→NodeGroups ends       (#pillars bottom @ viewport top)     */
  q1: number;
  /** scrollY where NodeGroups→Abyss begins           (#nodes top @ viewport top)          */
  r0: number;
  /** scrollY where NodeGroups→Abyss ends             (#nodes top + 100 vh)                */
  r1: number;
}
let _bounds: Boundaries | null = null;

/**
 * Lenis-authoritative scroll position (px) and page limit (px).
 *
 * Exported as module-level `let` bindings (ES module live bindings) so
 * OrbToWaveParticles and BackgroundMesh can read them synchronously inside
 * useFrame without subscribing to any React/Zustand state.
 *
 * Why not window.scrollY?
 *   html { scroll-behavior: smooth } makes the browser try to smooth-scroll
 *   every window.scrollTo() call Lenis issues each rAF — creating a
 *   double-smoothing lag.  window.scrollY then reflects the browser's
 *   in-progress animation, NOT Lenis's intended position.  Lenis's own
 *   e.scroll is always the correct eased value.
 */
export let _lenisScroll: number = 0;
export let _lenisLimit:  number = 1;

/**
 * Snapshot raw offsetTop values while scrollY === 0 so no element is
 * position:fixed by an active GSAP pin (which would corrupt offsetTop).
 *
 * MUST be called AFTER ScrollTrigger.refresh() — refresh inserts the Nodes
 * pin spacer into the DOM, finalising document height and section offsets.
 *
 * Boundary derivations mirror the three ScrollTrigger.onUpdate callbacks
 * that GlobalScrollSync replaces:
 *
 *   Transition A  start:"center center" end:"bottom top"  on #platform
 *   Transition B  start:"top top"       end:"bottom top"  on #pillars
 *   Transition C  start:"top top"       end:"+=100%"      on #nodes
 */
function cacheBoundaries(): void {
  const platform = document.getElementById("platform");
  const pillars  = document.getElementById("pillars");
  const nodes    = document.getElementById("nodes");

  if (!platform || !pillars || !nodes) { _bounds = null; return; }

  // Transition A: "center center" → platform centre is at viewport centre
  //   scrollY = platformTop + platformHeight/2 − viewportHeight/2
  const p0 = platform.offsetTop + platform.offsetHeight * 0.5 - window.innerHeight * 0.5;

  _bounds = {
    p0,
    p1: platform.offsetTop + platform.offsetHeight,            // "bottom top"
    q0: pillars.offsetTop,                                      // "top top"
    q1: pillars.offsetTop  + pillars.offsetHeight,              // "bottom top"
    r0: nodes.offsetTop,                                        // "top top"
    r1: nodes.offsetTop    + window.innerHeight,                // "+=100%"
  };
}

/**
 * Map scrollY → scrollState 0–3 using cached section boundaries.
 * Identical in output to the three old ScrollTrigger.onUpdate callbacks.
 */
function calcScrollState(): number {
  if (!_bounds) return scrollStore.getState().scrollState; // no-op if not on home
  const { p0, p1, q0, q1, r0, r1 } = _bounds;
  const y = _lenisScroll;

  if (y <= p0) return 0;
  if (y <= p1) return (y - p0) / (p1 - p0);           // 0 → 1 (Orb → DataHorizon)
  if (y <= q0) return 1;
  if (y <= q1) return 1 + (y - q0) / Math.max(1, q1 - q0); // 1 → 2 (DataHorizon → Nodes)
  if (y <= r0) return 2;
  if (y <= r1) return 2 + (y - r0) / Math.max(1, r1 - r0); // 2 → 3 (Nodes → Abyss)
  return 3;
}

export function GlobalScrollSync() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);

  // ── One-time initialisation ─────────────────────────────────────────────────
  useEffect(() => {
    if (_initialized) return;
    _initialized = true;

    gsap.registerPlugin(ScrollTrigger);

    _lenis = new Lenis({
      duration:        1.25,
      easing:          (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel:     true,
      touchMultiplier: 1.6,
      wheelMultiplier: 1.0,
    });

    // Single rAF loop: GSAP drives Lenis, Lenis drives ScrollTrigger
    gsap.ticker.add((time: number) => _lenis!.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    _lenis.on("scroll", (e: { scroll: number; limit: number; velocity: number }) => {
      // Capture Lenis's own authoritative position — never stale, even when
      // html { scroll-behavior: smooth } would corrupt window.scrollY.
      _lenisScroll = e.scroll;
      _lenisLimit  = Math.max(1, e.limit);
      scrollStore.setState({ velocity: e.velocity });
      ScrollTrigger.update();

      // Skip WebGL state writes on ambient routes — RouteSync owns scrollState there
      if (scrollStore.getState().isPricing) return;
      scrollStore.setState({ scrollState: calcScrollState() });
    });

    // ── Preloader completion → first-load boundary snapshot ──────────────
    // cacheBoundaries() is never called on the first-mount pathname effect
    // (prev === null early-return). This subscriber fills that gap: it fires
    // exactly once when IntroCurtain reaches phase "gone" (~4.5 s after paint)
    // and gives the browser 100 ms to settle before snapshotting offsets.
    //
    // Why 100 ms?  ScrollController's own setTimeout(refresh, 80) fires at
    // ~96 ms post-mount.  Waiting an additional 100 ms after the preloader
    // ends guarantees we read positions AFTER that refresh has run and the
    // Nodes pin-spacer (100 vh div) is already in the DOM.
    const unsubPreloader = scrollStore.subscribe((state, prev) => {
      if (state.isPreloaderComplete && !prev.isPreloaderComplete) {
        unsubPreloader(); // one-shot — never needed again
        setTimeout(() => {
          requestAnimationFrame(() => {
            ScrollTrigger.refresh();
            cacheBoundaries();
          });
        }, 100);
      }
    });

    // ── ResizeObserver: belt-and-suspenders height-change fallback ────────
    // Catches the GSAP pin-spacer insertion (which adds 100 vh to document
    // height) and any Framer Motion entrance shifts that settle after the
    // preloader.  250 ms debounce prevents thrashing during rapid repaints.
    // Guard: only fires on the home route (where #platform exists) and after
    // the preloader has completed (prevents premature reads during the 4.5 s
    // curtain when document height is already correct but _bounds is not set).
    let roTimer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(roTimer);
      roTimer = setTimeout(() => {
        if (!document.getElementById("platform")) return;
        if (!scrollStore.getState().isPreloaderComplete) return;
        requestAnimationFrame(() => {
          ScrollTrigger.refresh();
          cacheBoundaries();
        });
      }, 250);
    });
    ro.observe(document.body);

    // ── Window resize: re-cache after viewport change ──────────────────────
    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (document.getElementById("platform")) {
          requestAnimationFrame(() => {
            ScrollTrigger.refresh();
            cacheBoundaries();
          });
        }
      }, 150);
    };
    window.addEventListener("resize", onResize, { passive: true });

    // Intentionally no cleanup — Lenis singleton must persist for the app lifetime
  }, []);

  // ── Route-change cleanup ────────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevPath.current;
    prevPath.current = pathname;
    if (prev === null) return; // First mount — no stale state to clean up

    // Step 1: Scroll to 0 immediately.
    // _lenis is already initialised (init effect fired first, same hook order).
    // immediate:true bypasses Lenis smooth-scroll so the jump is frame-perfect.
    // window.scrollTo is a belt-and-suspenders guard for bfcache edge cases.
    _lenis?.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);

    // Step 2: Kill ALL stale ScrollTriggers synchronously.
    // clearScrollMemory must run before killAll — calling it after leaves GSAP's
    // internal scroll-position cache in a partially-cleaned state that can corrupt
    // subsequent refresh() calls.
    ScrollTrigger.clearScrollMemory();
    ScrollTrigger.killAll();

    // Step 3: After the new page's rAFs have registered fresh triggers,
    // refresh GSAP's layout snapshot and re-cache section boundaries.
    // React child effects fire before parent effects, so rAF-SC and rAF-N
    // are already queued ahead of this rAF-G in the rAF queue.
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      cacheBoundaries();
    });
  }, [pathname]);

  return null;
}
