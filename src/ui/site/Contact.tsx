"use client";

import React, { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { SynapticLoader } from "./SynapticLoader";
import { Nav } from "./Nav";
import { TransitionLink } from "./TransitionLink";

// ── Constants ─────────────────────────────────────────────────────────────────
const EASE = [0.16, 1, 0.3, 1] as const;
const SPRING = { type: "spring", stiffness: 380, damping: 24, mass: 0.6 } as const;

const STATUS_ITEMS = [
  { label: "ELITE ACCESS",  value: "6 SLOTS / QTR" },
  { label: "ENCRYPTION",    value: "AES-256" },
  { label: "RESPONSE TIME", value: "< 24 HOURS" },
] as const;

// Shared onChange type — covers both input and textarea change events.
type OnChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

// ── Floating-label terminal input ─────────────────────────────────────────────
/**
 * Single-line terminal-aesthetic field: border-bottom only, transparent bg,
 * floating label that rises on focus or when the field has a value.
 * A soft cyan glow underlines the border while focused.
 */
function TerminalField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  required,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: OnChange;
  autoComplete?: string;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const floating = focused || value.length > 0;

  return (
    <div className="relative pt-6">
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        required={required}
        className={[
          "w-full bg-transparent border-b py-2.5 text-white/90 text-sm",
          "focus:outline-none transition-all duration-300 caret-cyan-400",
          focused ? "border-cyan-400/60" : "border-white/12 hover:border-white/22",
        ].join(" ")}
        style={focused ? { boxShadow: "0 1px 0 0 rgba(0,229,255,0.28)" } : {}}
      />
      <label
        htmlFor={id}
        className={[
          "absolute left-0 pointer-events-none transition-all duration-300",
          floating
            ? [
                "top-0 text-[9px] tracking-[0.24em] uppercase font-mono",
                focused ? "text-cyan-400/75" : "text-white/28",
              ].join(" ")
            : "top-6 text-sm text-white/32 font-sans tracking-wide",
        ].join(" ")}
      >
        {label}
      </label>
    </div>
  );
}

// ── Floating-label terminal textarea ─────────────────────────────────────────
/**
 * Auto-expanding textarea variant. Height resets to "auto" on each keystroke
 * then snaps to scrollHeight, giving organic growth with no scroll bars.
 */
function TerminalTextarea({
  id,
  label,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: OnChange;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const floating = focused || value.length > 0;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e);
    if (areaRef.current) {
      areaRef.current.style.height = "auto";
      areaRef.current.style.height = `${areaRef.current.scrollHeight}px`;
    }
  };

  return (
    <div className="relative pt-6">
      <textarea
        ref={areaRef}
        id={id}
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={2}
        required={required}
        className={[
          "w-full bg-transparent border-b py-2.5 text-white/90 text-sm",
          "focus:outline-none transition-all duration-300 resize-none",
          "caret-cyan-400 leading-relaxed overflow-hidden",
          focused ? "border-cyan-400/60" : "border-white/12 hover:border-white/22",
        ].join(" ")}
        style={focused ? { boxShadow: "0 1px 0 0 rgba(0,229,255,0.28)" } : {}}
      />
      <label
        htmlFor={id}
        className={[
          "absolute left-0 pointer-events-none transition-all duration-300",
          floating
            ? [
                "top-0 text-[9px] tracking-[0.24em] uppercase font-mono",
                focused ? "text-cyan-400/75" : "text-white/28",
              ].join(" ")
            : "top-6 text-sm text-white/32 font-sans tracking-wide",
        ].join(" ")}
      >
        {label}
      </label>
    </div>
  );
}

// ── Magnetic submit button ────────────────────────────────────────────────────
/**
 * Replicates GlassButton's GSAP magnetic pull + Framer Motion spring scale,
 * rendered as a <button type="submit"> so it can live inside a <form>.
 */
function MagneticSubmit({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - r.left - r.width / 2) * 0.4,
        y: (e.clientY - r.top - r.height / 2) * 0.4,
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
        ease: "elastic.out(1,0.5)",
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
    <motion.button
      ref={ref}
      type="submit"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      transition={SPRING}
      className="shine-on-hover relative overflow-hidden inline-flex items-center gap-2.5 font-medium text-white px-7 py-3 text-sm rounded-2xl glass glass-strong"
    >
      <span className="shine-layer" aria-hidden />
      <span className="relative z-[2] inline-flex items-center gap-2.5">
        {children}
        {/* Arrow icon */}
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
          <path
            d="M1 6.5h11M7.5 2l4.5 4.5L7.5 11"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </motion.button>
  );
}

// ── Contact page ──────────────────────────────────────────────────────────────
/**
 * Contact — ARGOS Elite Access request page.
 *
 * Layout: asymmetrical 5:7 split.
 *   Left  — cinematic stacked headline + status indicators (dark, typographic)
 *   Right — glassmorphism "terminal" form card
 *
 * Form submission: constructs a formatted mailto: URI and fires it via
 * window.location.href. On click, a GSAP sequence fades out the form and
 * fades in the success message without a page reload.
 *
 * WebGL ambient state: RouteSync sets isPricing=true for /contact so the
 * particle system slows to 50 % and the camera locks to the node-cluster
 * vantage, matching the /pricing ambient behaviour.
 */
export function Contact() {
  const [loaderDone, setLoaderDone] = useState(false);
  const handleLoaderDone = useCallback(() => setLoaderDone(true), []);

  const [form, setForm] = useState({
    name:      "",
    email:     "",
    industry:  "",
    use_case:  "",
  });

  const formCardRef = useRef<HTMLDivElement>(null);
  const successRef  = useRef<HTMLDivElement>(null);

  // Generic field setter
  const set = (key: keyof typeof form): OnChange =>
    (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // ── Construct mailto URI ──────────────────────────────────────────────
    const subject = encodeURIComponent(
      `ARGOS Elite Access Request — ${form.name || "Anonymous"}`
    );
    const body = encodeURIComponent(
      [
        `NAME        ${form.name}`,
        `EMAIL       ${form.email}`,
        `INDUSTRY    ${form.industry}`,
        ``,
        `USE CASE / REQUIREMENTS`,
        `${"─".repeat(44)}`,
        form.use_case,
        ``,
        `${"─".repeat(44)}`,
        `Submitted via ARGOS Elite Access Form`,
        `https://argos.run/contact`,
      ].join("\n")
    );

    window.location.href =
      `mailto:christianshen49@gmail.com?subject=${subject}&body=${body}`;

    // ── GSAP success transition ───────────────────────────────────────────
    const card    = formCardRef.current;
    const success = successRef.current;
    if (!card || !success) return;

    gsap.to(card, {
      opacity: 0,
      y: -20,
      duration: 0.42,
      ease: "power3.in",
      onComplete: () => {
        gsap.set(card,    { display: "none" });
        gsap.set(success, { display: "flex" });
        gsap.fromTo(
          success,
          { opacity: 0, y: 24, filter: "blur(10px)" },
          { opacity: 1, y: 0,  filter: "blur(0px)", duration: 0.68, ease: "power3.out" }
        );
      },
    });
  };

  return (
    <div className="relative min-h-screen w-full bg-transparent">
      {/* Synaptic preloader — same mitosis animation as /pricing */}
      {!loaderDone && <SynapticLoader onComplete={handleLoaderDone} />}

      <Nav pricingMode />

      <main
        className="relative z-10 flex min-h-screen items-center px-6 pt-28 pb-20"
        style={{ opacity: loaderDone ? 1 : 0, transition: "opacity 0.5s ease" }}
      >
        <div className="mx-auto w-full max-w-7xl grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-14 lg:gap-24 items-center">

          {/* ── LEFT: cinematic typography panel ──────────────────────────── */}
          <motion.div
            className="flex flex-col gap-10 lg:pr-4"
            initial={{ opacity: 0, x: -36 }}
            animate={loaderDone ? { opacity: 1, x: 0 } : { opacity: 0, x: -36 }}
            transition={{ duration: 0.88, ease: EASE, delay: 0.1 }}
          >
            {/* Overline */}
            <span className="text-[10px] tracking-[0.38em] uppercase text-white/35 font-mono">
              Elite Access
            </span>

            {/* Stacked display headline — each line animates independently */}
            <div className="flex flex-col leading-none select-none">
              {(["TELL", "US YOUR", "SCALE."] as const).map((line, i) => (
                <motion.span
                  key={line}
                  className={[
                    "text-[3.2rem] sm:text-[4rem] xl:text-[4.8rem] font-black tracking-tight",
                    i === 2
                      // "SCALE." — neon cyan #00E5FF → cyan-200 → white/70
                      ? "bg-gradient-to-r from-[#00E5FF] via-cyan-200 to-white/70 bg-clip-text text-transparent"
                      : "text-white",
                  ].join(" ")}
                  initial={{ opacity: 0, y: 28 }}
                  animate={loaderDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
                  transition={{ duration: 0.68, ease: EASE, delay: 0.22 + i * 0.1 }}
                >
                  {line}
                </motion.span>
              ))}
            </div>

            {/* Secondary copy */}
            <motion.p
              className="text-sm text-white/40 leading-relaxed max-w-[280px]"
              initial={{ opacity: 0 }}
              animate={loaderDone ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.58 }}
            >
              We engineer bare-metal H200 infrastructure around your exact
              architecture. Six pilots per quarter. Zero off-the-shelf.
            </motion.p>

            {/* Status indicators */}
            <motion.ul
              className="flex flex-col gap-3.5"
              initial={{ opacity: 0 }}
              animate={loaderDone ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.72 }}
            >
              {STATUS_ITEMS.map((s) => (
                <li key={s.label} className="flex items-center gap-3">
                  {/* Pulsing cyan status dot */}
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"
                    style={{ boxShadow: "0 0 7px 2px rgba(0,229,255,0.5)" }}
                  />
                  <span className="text-[10px] tracking-[0.22em] uppercase font-mono text-white/30">
                    {s.label}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400/55 ml-0.5">
                    · {s.value}
                  </span>
                </li>
              ))}
            </motion.ul>

            {/* Back to pricing */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={loaderDone ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.9 }}
            >
              <TransitionLink
                href="/pricing"
                className="text-[11px] tracking-[0.22em] uppercase font-mono text-white/28 hover:text-white/60 transition-colors"
              >
                ← Back to Pricing
              </TransitionLink>
            </motion.div>
          </motion.div>

          {/* ── RIGHT: terminal form glass card ───────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 36 }}
            animate={loaderDone ? { opacity: 1, x: 0 } : { opacity: 0, x: 36 }}
            transition={{ duration: 0.88, ease: EASE, delay: 0.22 }}
          >
            {/* ── Form card ─────────────────────────────────────────── */}
            <div ref={formCardRef} className="glass glass-abyss rounded-3xl p-8 sm:p-11">

              {/* Fake terminal window chrome */}
              <div className="flex items-center gap-2 mb-9">
                <span className="w-2 h-2 rounded-full bg-white/12" />
                <span className="w-2 h-2 rounded-full bg-white/8"  />
                <span
                  className="w-2 h-2 rounded-full bg-cyan-400/45"
                  style={{ boxShadow: "0 0 6px rgba(0,229,255,0.50)" }}
                />
                <span className="ml-3.5 text-[9px] tracking-[0.26em] uppercase font-mono text-white/22">
                  argos://elite/contact_init
                </span>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-9">
                <TerminalField
                  id="name"
                  label="How should we address you?"
                  value={form.name}
                  onChange={set("name")}
                  autoComplete="name"
                  required
                />
                <TerminalField
                  id="email"
                  type="email"
                  label="Your email address"
                  value={form.email}
                  onChange={set("email")}
                  autoComplete="email"
                  required
                />
                <TerminalField
                  id="industry"
                  label="What industry do you operate in?"
                  value={form.industry}
                  onChange={set("industry")}
                />
                <TerminalTextarea
                  id="use_case"
                  label="How can ARGOS accelerate your growth?"
                  value={form.use_case}
                  onChange={set("use_case")}
                />

                {/* Footer row: encryption note + CTA */}
                <div className="pt-2 flex items-center justify-between flex-wrap gap-4">
                  <p className="text-[9px] tracking-[0.2em] uppercase font-mono text-white/18">
                    AES-256 · Confidential
                  </p>
                  <MagneticSubmit>Initialize Request</MagneticSubmit>
                </div>
              </form>
            </div>

            {/* ── Success state (hidden, revealed by GSAP) ─────────────── */}
            <div
              ref={successRef}
              className="glass glass-abyss rounded-3xl p-8 sm:p-11 flex-col items-center justify-center text-center gap-7 min-h-[440px]"
              style={{ display: "none" }}
            >
              {/* Checkmark ring */}
              <div
                className="w-14 h-14 rounded-full border border-cyan-400/35 flex items-center justify-center"
                style={{ boxShadow: "0 0 40px 0 rgba(0,229,255,0.12)" }}
              >
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
                  <path
                    d="M4 11l5 5 9-9"
                    stroke="rgba(0,229,255,0.80)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Message */}
              <div className="flex flex-col gap-2.5">
                <p className="text-white/82 text-xl font-semibold tracking-tight">
                  Signal transmitted.
                </p>
                <p className="text-white/38 text-sm leading-relaxed max-w-xs">
                  We will orchestrate your node shortly.
                </p>
              </div>

              {/* Terminal footer */}
              <span className="text-[9px] tracking-[0.28em] uppercase font-mono text-white/18">
                argos://elite/transmitted · awaiting_orchestration
              </span>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
