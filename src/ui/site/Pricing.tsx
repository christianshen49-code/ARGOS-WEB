"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { SpotlightCard } from "./SpotlightCard";
import { GlassButton } from "./GlassButton";
import { Reveal } from "./Reveal";
import { SynapticLoader } from "./SynapticLoader";
import { Nav } from "./Nav";
import { TransitionLink } from "./TransitionLink";
import { pageTransition } from "./pageTransition";

// ── Plan data ─────────────────────────────────────────────────────────────────
const PLANS = [
  {
    tier: "Professional",
    price: "$2,499",
    period: "/mo",
    description: "Production-ready H200 routing for brands scaling past their first inflection point.",
    features: [
      "10M Global Requests",
      "Standard H200 Model Routing",
      "99.9% Mesh SLA",
      "Shared Synapse Nodes",
      "Standard Support",
    ],
    cta: "Start Pilot",
    ctaHref: "mailto:pilot@argos.run",
    highlight: false,
    spotlightColor: "rgba(255, 255, 255, 0.14)",
  },
  {
    tier: "Enterprise",
    price: "$7,999",
    period: "/mo",
    description: "Priority infrastructure for brands that cannot afford a single dropped request.",
    features: [
      "50M Global Requests",
      "Priority H200 Access",
      "Dedicated Routing Logic",
      "99.99% Uptime SLA",
      "Premium Support",
    ],
    cta: "Scale Now",
    ctaHref: "mailto:enterprise@argos.run",
    highlight: true,
    spotlightColor: "rgba(0, 229, 255, 0.22)",
  },
  {
    tier: "Elite",
    price: "Custom",
    period: "",
    description: "Bare-metal orchestration engineered around your exact architecture and compliance posture.",
    features: [
      "Unlimited Requests",
      "Bare-metal H200 Clusters",
      "Custom Mesh Orchestration",
      "24/7 AI Concierge",
      "On-premise Options",
    ],
    cta: "Contact Sales",
    ctaHref: "mailto:sales@argos.run",
    highlight: false,
    spotlightColor: "rgba(255, 255, 255, 0.14)",
  },
] as const;

const EASE = [0.16, 1, 0.3, 1] as const;

// ── Check icon ────────────────────────────────────────────────────────────────
function Check({ accent }: { accent: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0, color: accent ? "rgba(0,229,255,0.75)" : "rgba(255,255,255,0.35)" }}
    >
      <path
        d="M2 6.5L5 9.5L11 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Pricing page ──────────────────────────────────────────────────────────────
/**
 * Pricing — the ARGOS pricing page.
 *
 * Mount sequence:
 *   1. SynapticLoader plays (dormant → dividing → exit, ~1.9 s total).
 *   2. Content fades in (opacity transition driven by loaderDone state).
 *   3. SpotlightCard cards stagger up via framer-motion variants.
 *
 * Each card:
 *   · Glassmorphism via the existing `.glass` + `.glass-card` + `.spotlight-host`
 *     chain applied by SpotlightCard.
 *   · Cursor-tracked bioluminescent spotlight via --mouse-x/--mouse-y CSS vars
 *     (SpotlightCard handles the mousemove listener).
 *   · Magnetic GlassButton CTAs (GlassButton's GSAP magnetic hook is active).
 */
export function Pricing() {
  const [loaderDone, setLoaderDone] = useState(false);
  const handleLoaderDone = useCallback(() => setLoaderDone(true), []);

  return (
    <div className="relative min-h-screen w-full bg-transparent">
      {/* Synaptic mitosis preloader — plays once on mount */}
      {!loaderDone && <SynapticLoader onComplete={handleLoaderDone} />}

      {/* Nav — faster entrance on pricing (no 3.5 s intro sequence here) */}
      <Nav pricingMode />

      <main
        className="relative z-10 flex flex-col items-center px-6 pt-36 pb-28"
        style={{ opacity: loaderDone ? 1 : 0, transition: "opacity 0.5s ease" }}
      >
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <Reveal className="text-center mb-16 sm:mb-20 max-w-3xl mx-auto">
          <span className="text-[10px] tracking-[0.38em] uppercase text-white/40 font-mono">
            Infrastructure Pricing
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.04] text-white">
            Choose your mesh.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-white/55 leading-relaxed">
            Every plan runs on the same H200 backbone.
            The only difference is how much of it you own.
          </p>
        </Reveal>

        {/* ── Pricing cards ────────────────────────────────────────────────── */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-6xl"
          initial="hidden"
          animate={loaderDone ? "visible" : "hidden"}
          variants={{ visible: { transition: { staggerChildren: 0.14 } } }}
        >
          {PLANS.map((plan) => (
            <SpotlightCard
              key={plan.tier}
              spotlightColor={plan.spotlightColor}
              as="div"
              duration={1.2}
              className={[
                // glass-abyss stacks on SpotlightCard's .glass to apply the
                // indigo tint + purple border that harmonises with COL_NODES.
                "relative flex flex-col gap-6 rounded-3xl p-8 sm:p-10 glass-abyss",
                plan.highlight
                  ? "ring-1 ring-cyan-400/30 shadow-[0_0_70px_-12px_rgba(0,229,255,0.20)]"
                  : "ring-1 ring-white/[0.08]",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* Enterprise badge */}
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="px-3 py-1 rounded-full text-[10px] tracking-[0.28em] uppercase font-mono text-cyan-300/90 bg-cyan-400/[0.08] border border-cyan-400/20">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Tier label + price */}
              <div className="flex flex-col gap-1.5">
                <span
                  className="text-[10px] tracking-[0.32em] uppercase font-mono"
                  style={{
                    color: plan.highlight
                      ? "rgba(0,229,255,0.75)"
                      : "rgba(255,255,255,0.38)",
                  }}
                >
                  {plan.tier}
                </span>

                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-[2.6rem] sm:text-5xl font-bold text-white tracking-tight leading-none">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-white/40 text-sm font-mono pb-1">{plan.period}</span>
                  )}
                </div>

                <p className="text-sm text-white/48 leading-relaxed mt-1.5">{plan.description}</p>
              </div>

              {/* Divider */}
              <div
                className="h-px"
                style={{
                  background: plan.highlight
                    ? "linear-gradient(to right, transparent, rgba(0,229,255,0.18), transparent)"
                    : "rgba(255,255,255,0.055)",
                }}
              />

              {/* Feature list */}
              <ul className="flex flex-col gap-3.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-white/72">
                    <Check accent={plan.highlight} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA — Elite tier routes to /contact via warp transition */}
              <div className="mt-2">
                <GlassButton
                  href={plan.tier === "Elite" ? "/contact" : plan.ctaHref}
                  primary={plan.highlight}
                  size="lg"
                  radius="2xl"
                  className="w-full justify-center"
                  onClick={
                    plan.tier === "Elite"
                      ? (e: React.MouseEvent<HTMLAnchorElement>) => {
                          e.preventDefault();
                          pageTransition.navigate("/contact");
                        }
                      : undefined
                  }
                >
                  {plan.cta}
                </GlassButton>
              </div>
            </SpotlightCard>
          ))}
        </motion.div>

        {/* Footer note */}
        <motion.p
          className="mt-14 text-[10px] tracking-[0.26em] uppercase text-white/28 font-mono text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={loaderDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.8, delay: 0.9, ease: EASE }}
        >
          All plans billed monthly · No lock-in · Cancel anytime
        </motion.p>

        {/* Back link */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0 }}
          animate={loaderDone ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 1.1, ease: EASE }}
        >
          <TransitionLink
            href="/"
            className="text-[11px] tracking-[0.24em] uppercase font-mono text-white/35 hover:text-white/70 transition-colors"
          >
            ← Back to ARGOS
          </TransitionLink>
        </motion.div>
      </main>
    </div>
  );
}
