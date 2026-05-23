"use client";

import { useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import { pageTransition } from "./pageTransition";

/**
 * PageTransitionOverlay — the "Hyperspace Warp" that plays between routes.
 *
 * Visual: a full-screen dark glass panel that expands radially from the
 * viewport centre (clip-path circle 0% → 150%) on exit, then collapses
 * (150% → 0%) after the new page has mounted.
 *
 * Lifecycle:
 *   EXIT  — TransitionLink calls pageTransition.navigate(href)
 *            → overlay expands (power3.in, 0.55 s)
 *            → router.push(href) fires on animation complete
 *   ENTER — usePathname detects the new route
 *            → overlay collapses (expo.out, 0.70 s, 80 ms delay)
 *            → overlay hides (display:none) when fully collapsed
 */
export function PageTransitionOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  // Register as the global transition handler on mount
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    pageTransition.register((href: string) => {
      gsap.set(el, { display: "block", clipPath: "circle(0% at 50% 50%)" });
      gsap.to(el, {
        clipPath: "circle(150% at 50% 50%)",
        duration: 0.55,
        ease: "power3.in",
        onComplete: () => router.push(href),
      });
    });
  }, [router]);

  // Collapse overlay when the new pathname is detected (page has mounted)
  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;
    const el = overlayRef.current;
    if (!el) return;

    gsap.to(el, {
      clipPath: "circle(0% at 50% 50%)",
      duration: 0.70,
      ease: "expo.out",
      delay: 0.08,
      onComplete: () => gsap.set(el, { display: "none" }),
    });
  }, [pathname]);

  return (
    <div
      ref={overlayRef}
      style={{ display: "none", clipPath: "circle(0% at 50% 50%)" }}
      className="fixed inset-0 z-[998] pointer-events-none"
      aria-hidden
    >
      {/* Dark glass fill */}
      <div className="absolute inset-0 bg-[#020202]/93 backdrop-blur-2xl" />

      {/* Warp core — a single cyan photon at the expansion origin */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-px h-px rounded-full bg-cyan-400"
          style={{
            boxShadow:
              "0 0 0 0 rgba(0,229,255,0.9), 0 0 80px 30px rgba(0,229,255,0.25), 0 0 200px 80px rgba(0,229,255,0.08)",
          }}
        />
      </div>
    </div>
  );
}
