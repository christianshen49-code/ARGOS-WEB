"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { GlassButton } from "./GlassButton";
import { TransitionLink } from "./TransitionLink";
import { pageTransition } from "./pageTransition";

/** ARGOS mark — orbital rings around a center node. */
function ArgosMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)" />
    </svg>
  );
}

const EASE = [0.16, 1, 0.3, 1] as const;

interface NavProps {
  /** On /pricing there is no 3.5 s intro sequence, so the nav enters faster. */
  pricingMode?: boolean;
}

export function Nav({ pricingMode = false }: NavProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE, delay: pricingMode ? 0.2 : 3.5 }}
      className="fixed top-4 left-1/2 z-30"
      style={{
        // Pull-up + width-shrink encoded directly so the resize is GPU-driven.
        x: "-50%",
        width: scrolled ? "min(720px, calc(100% - 2rem))" : "min(960px, calc(100% - 2rem))",
        transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <motion.div
        animate={{
          paddingTop: scrolled ? "0.5rem" : "0.625rem",
          paddingBottom: scrolled ? "0.5rem" : "0.625rem",
        }}
        transition={{ duration: 0.5, ease: EASE }}
        className="glass flex items-center justify-between gap-6 rounded-2xl px-4 sm:px-5"
      >
        <TransitionLink href="/" className="flex items-center gap-2.5 text-white cursor-pointer">
          <ArgosMark />
          <span className="text-[15px] font-semibold tracking-[0.18em]">ARGOS</span>
        </TransitionLink>

        <nav className="hidden sm:flex items-center gap-7 text-sm text-white/75">
          <a href="#platform" className="hover:text-white transition-colors">
            Platform
          </a>
          <a href="#nodes" className="hover:text-white transition-colors">
            Nodes
          </a>
          <TransitionLink href="/pricing" className="hover:text-white transition-colors">
            Pricing
          </TransitionLink>
        </nav>

        <GlassButton
          href="/pricing"
          size="sm"
          onClick={(e) => { e.preventDefault(); pageTransition.navigate("/pricing"); }}
        >
          Request Access
        </GlassButton>
      </motion.div>
    </motion.header>
  );
}
