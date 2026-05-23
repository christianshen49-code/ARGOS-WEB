"use client";

import { Reveal } from "./Reveal";
import { SectionTransition } from "./SectionTransition";
import { SpotlightCard } from "./SpotlightCard";
import { ScrollFrame } from "./ScrollFrame";

const PILLARS = [
  {
    id: "01",
    title: "Autonomous Routing",
    body: "Real-time model selection across H200 fleets. ARGOS picks the right weight class for each request — Opus, Sonnet, or a tuned in-house model — and re-routes on degradation in under 80 ms.",
    metric: "< 80ms",
    metricLabel: "route decision",
  },
  {
    id: "02",
    title: "High-Fidelity Rendering",
    body: "Production-grade 3D, video, and product-imagery pipelines built for the premium tier. Frame budgets are scheduled across nodes so even 4K hero shots ship inside a single PDP request.",
    metric: "4K · 60fps",
    metricLabel: "PDP hero",
  },
  {
    id: "03",
    title: "Workflow-as-a-Service",
    body: "Every step is an API call. ARGOS composes long-running commerce workflows — pricing, copy, imagery, fulfillment — and replays them deterministically with full lineage on every output.",
    metric: "100%",
    metricLabel: "replayable lineage",
  },
];

export function Pillars() {
  return (
    <section
      id="pillars"
      className="relative w-full min-h-screen flex items-center overflow-hidden"
    >
      {/* Background provided by the page-level MorphCanvas which has fully
          morphed into the horizon line by the time this section is reached. */}
      <SectionTransition tint="rgba(138, 43, 226, 0.18)" />

      {/* Soft bottom vignette so the cards stay readable against the
          luminous horizon glow and the section seams into Nodes below. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-72 pointer-events-none bg-gradient-to-b from-transparent via-black/30 to-black/85 z-[1]"
      />

      <ScrollFrame className="relative z-10 mx-auto max-w-6xl w-full px-6 py-24 sm:py-32">
        {/*
          Heading text — animated by GSAP Phase 4 (ScrollController.tsx).
          id="pillars-text" is the selector; direct children are staggered
          with y:60, blur:8px, power4.out. No framer-motion on these nodes
          so there is zero variant-state conflict.
        */}
        <div id="pillars-text" className="flex flex-col gap-3 max-w-2xl">
          <span className="text-[11px] tracking-[0.32em] uppercase text-white/55 font-mono">
            01 — Platform
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.08] text-white">
            Three layers, one orchestrator.
          </h2>
          <p className="text-base sm:text-lg text-white/75 mt-2 leading-relaxed">
            ARGOS replaces the stack of glue code that sits between your storefront,
            your model providers, and your render farms. One control plane. One bill.
          </p>
        </div>

        <Reveal
          as="div"
          stagger={0.1}
          delay={0.15}
          className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5"
        >
          {PILLARS.map((p) => (
            <SpotlightCard
              key={p.id}
              spotlightColor="rgba(156, 100, 255, 0.28)"
              className="rounded-2xl p-7 flex flex-col gap-4 min-h-[340px]"
            >
              <div className="flex items-center justify-between text-[11px] tracking-[0.32em] uppercase text-white/45 font-mono">
                <span>{p.id}</span>
                <span>Pillar</span>
              </div>

              <h3 className="text-xl font-semibold text-white tracking-tight">
                {p.title}
              </h3>

              <p className="text-sm text-white/65 leading-relaxed flex-1">
                {p.body}
              </p>

              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-white tabular-nums">
                  {p.metric}
                </span>
                <span className="text-[11px] tracking-[0.24em] uppercase text-white/40 font-mono">
                  {p.metricLabel}
                </span>
              </div>
            </SpotlightCard>
          ))}
        </Reveal>
      </ScrollFrame>
    </section>
  );
}
