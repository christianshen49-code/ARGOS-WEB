"use client";

import { useRef, useEffect, type ReactNode } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import gsap from "gsap";
import { SpotlightCard } from "./SpotlightCard";
import { GlassButton } from "./GlassButton";
import { pageTransition } from "./pageTransition";

// ── Border-only magnetic secondary button ─────────────────────────────────────
/**
 * SecondaryButton — bare border-only CTA with the same GSAP magnetic behaviour
 * as GlassButton, but no glass fill.  Used for lower-hierarchy actions.
 */
function SecondaryButton({ href, children }: { href: string; children: ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(hover: none)").matches) return;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top  + rect.height / 2);
      gsap.to(el, {
        x: dx * 0.30,
        y: dy * 0.30,
        duration: 0.55,
        ease: "power3.out",
        overwrite: "auto",
      });
    };

    const onLeave = () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.85,
        ease: "elastic.out(1, 0.5)",
        overwrite: "auto",
      });
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      gsap.killTweensOf(el);
    };
  }, []);

  return (
    <a
      ref={ref}
      href={href}
      onClick={(e) => {
        e.preventDefault();
        pageTransition.navigate(href);
      }}
      className="
        inline-flex items-center justify-center gap-2
        px-6 py-3 rounded-xl text-sm sm:text-base font-medium tracking-[0.04em]
        border border-white/22 text-white/60
        hover:border-white/45 hover:text-white/90
        transition-colors duration-300
        cursor-pointer select-none
      "
    >
      {children}
    </a>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
/**
 * FinalCta — "Fullscreen Immersive Abyss"
 *
 * Layout: h-screen, content centered.
 * A massive SpotlightCard (the "glass container") is wrapped in a div
 * with id="access-container" — ScrollController parallaxes this div
 * from y:200 → 0 as it scrolls into view (scrub: 1.5).
 *
 * Buttons:
 *   · "Request Pilot Access" — primary GlassButton → /pricing
 *   · "Contact Us"           — border-only SecondaryButton → /contact
 *
 * The WebGL canvas (ambient particle background) already renders behind this
 * section via layout.tsx, so no additional background element is needed.
 */
export function FinalCta() {
  return (
    <section
      id="access"
      className="relative w-full h-screen flex items-center justify-center px-6 overflow-hidden"
    >
      {/* Parallax wrapper — GSAP targets this ID in ScrollController */}
      <div id="access-container" className="relative w-full max-w-5xl mx-auto">
        <SpotlightCard
          as="div"
          spotlightColor="rgba(138, 43, 226, 0.28)"
          duration={1.6}
          className="rounded-[2.5rem] p-14 sm:p-20 flex flex-col gap-8 items-center text-center"
        >
          {/* Eyebrow */}
          <span className="text-[11px] tracking-[0.40em] uppercase text-white/40 font-mono">
            Pilot Program
          </span>

          {/* Headline — massive, compressed weight */}
          <h2 className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tighter leading-[0.95] text-white">
            Route your next<br />launch on ARGOS.
          </h2>

          {/* Body */}
          <p className="text-base sm:text-lg text-white/55 max-w-xl leading-relaxed mt-1">
            We onboard six premium brands per quarter. Pilots ship inside thirty
            days — your stack, your storefront, our orchestrator.
          </p>

          {/* CTAs */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <GlassButton
              href="/pricing"
              primary
              size="lg"
              onClick={(e: ReactMouseEvent<HTMLAnchorElement>) => {
                e.preventDefault();
                pageTransition.navigate("/pricing");
              }}
            >
              Request Pilot Access
            </GlassButton>

            <SecondaryButton href="/contact">Contact Us</SecondaryButton>
          </div>
        </SpotlightCard>
      </div>

      {/* Footer — pinned to section bottom */}
      <footer className="absolute bottom-8 left-0 right-0 px-8 flex flex-wrap items-center justify-between gap-3 text-[11px] tracking-[0.28em] uppercase text-white/28 font-mono">
        <span>ARGOS · v0.3 Pilot</span>
        <span>© 2026 — All rights reserved</span>
      </footer>
    </section>
  );
}
