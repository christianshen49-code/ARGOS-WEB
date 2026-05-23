"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { scrollStore } from "@/ui/morph/store";

/**
 * ARGOS page-load sequence — three movements, ~4.5s total.
 *
 *   I.   WORDMARK   — letter-by-letter mask reveal, hold, mask up out
 *   II.  CHARGE     — the seam pre-glows under the dark while letters exit,
 *                     building anticipation before the page is revealed
 *   III. STAGE      — radial flash at center, shutters split with a subtle
 *                     scaleY squash (blinds-opening feel) + motion blur,
 *                     seam explodes outward and fades
 *   IV.  UNMOUNT
 *
 * The letters live in their OWN centered z-10 layer so the bottom shutter
 * doesn't clip the lower glyph edges at the seam line.
 *
 * Timeline:
 *   0.00s  in       letters mask up into view (1.0 s, stagger 0.1 s)
 *   0.55s  in       status hairline draws under the wordmark (1.1 s)
 *   1.40s  in/hold  letters rest, slightly longer breath
 *   2.20s  out      letters mask up out of view (0.7 s, stagger 0.05 s)
 *                   seam begins pre-glowing at low opacity (charge build)
 *   3.10s  stage    radial flash at center
 *                   shutters split (top y → -100% + scaleY 1 → 0.95)
 *                                   (bottom y → +100% + scaleY 1 → 0.95)
 *                   each panel carries blur(0 → 7 → 0) motion blur
 *                   seam scaleX [pre,full,full,0], opacity [pre,1,0.85,0]
 *   4.50s  gone     unmount
 */
const LETTERS = ["A", "R", "G", "O", "S"];
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_IN = [0.7, 0, 0.84, 0] as const;
const STAGE_EASE = [0.22, 1, 0.36, 1] as const;

type Phase = "in" | "out" | "stage" | "gone";

const GPU_LAYER = {
  willChange: "transform, opacity",
  backfaceVisibility: "hidden" as const,
  WebkitBackfaceVisibility: "hidden" as const,
  WebkitFontSmoothing: "antialiased" as const,
};

export function IntroCurtain() {
  const [phase, setPhase] = useState<Phase>("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("out"), 2200); // letters exit + charge build
    const t2 = setTimeout(() => setPhase("stage"), 3100); // flash + shutter split
    const t3 = setTimeout(() => {
      setPhase("gone");
      // Signal GlobalScrollSync that the first-paint preloader has finished.
      // GlobalScrollSync subscribes once and fires ScrollTrigger.refresh() +
      // cacheBoundaries() 100 ms later — after the browser has painted the
      // fully-revealed page — so section offsetTop values are layout-stable.
      scrollStore.setState({ isPreloaderComplete: true });
    }, 4500); // unmount
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (phase === "gone") return null;

  const charging = phase === "out";
  const splitting = phase === "stage";

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* ─── Top shutter half ─── */}
      <motion.div
        initial={{ y: 0, scaleY: 1, filter: "blur(0px)" }}
        animate={
          splitting
            ? {
                y: "-100%",
                scaleY: 0.96,
                filter: ["blur(0px)", "blur(7px)", "blur(0px)"],
              }
            : { y: 0, scaleY: 1, filter: "blur(0px)" }
        }
        transition={{ duration: 1.35, ease: STAGE_EASE, times: [0, 0.45, 1] }}
        style={{
          transformOrigin: "50% 100%",
          ...GPU_LAYER,
        }}
        className="absolute inset-x-0 top-0 h-1/2 bg-[#0a0a0a]"
      />

      {/* ─── Bottom shutter half ─── */}
      <motion.div
        initial={{ y: 0, scaleY: 1, filter: "blur(0px)" }}
        animate={
          splitting
            ? {
                y: "100%",
                scaleY: 0.96,
                filter: ["blur(0px)", "blur(7px)", "blur(0px)"],
              }
            : { y: 0, scaleY: 1, filter: "blur(0px)" }
        }
        transition={{ duration: 1.35, ease: STAGE_EASE, times: [0, 0.45, 1] }}
        style={{
          transformOrigin: "50% 0%",
          ...GPU_LAYER,
        }}
        className="absolute inset-x-0 bottom-0 h-1/2 bg-[#0a0a0a]"
      />

      {/* ─── Wordmark layer (above both shutters) ───
          Hoisted into its own viewport-centered z-10 layer so the bottom
          shutter doesn't clip the lower glyph edges at the seam line. */}
      <div className="absolute inset-0 grid place-items-center z-10 pointer-events-none">
        <div
          className="flex items-center"
          style={{
            paddingLeft: "0.42em",
            gap: "0.42em",
            fontSize: "clamp(2rem, 6vw, 4.5rem)",
            lineHeight: 1,
            WebkitFontSmoothing: "antialiased",
            textRendering: "optimizeLegibility",
          }}
        >
          {LETTERS.map((ch, i) => (
            <span
              key={i}
              className="inline-block overflow-hidden"
              style={{ lineHeight: 1 }}
            >
              <motion.span
                initial={{ y: "110%", opacity: 0 }}
                animate={
                  phase === "in"
                    ? { y: "0%", opacity: 1 }
                    : { y: "-110%", opacity: 0 }
                }
                transition={{
                  duration: phase === "in" ? 1.0 : 0.7,
                  ease: phase === "in" ? EASE_OUT : EASE_IN,
                  delay: phase === "in" ? i * 0.1 : i * 0.05,
                }}
                className="inline-block text-white font-bold"
                style={{
                  letterSpacing: "0.32em",
                  textRendering: "optimizeLegibility",
                  ...GPU_LAYER,
                }}
              >
                {ch}
              </motion.span>
            </span>
          ))}
        </div>

        {/* Status hairline under the wordmark — fades before split */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={
            phase === "in"
              ? { scaleX: 1, opacity: 0.7 }
              : { scaleX: 1, opacity: 0 }
          }
          transition={{
            duration: 1.1,
            ease: EASE_OUT,
            delay: phase === "in" ? 0.55 : 0,
          }}
          style={{
            transformOrigin: "50% 50%",
            position: "absolute",
            top: "calc(50% + 72px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(320px, 60vw)",
            height: "1px",
            ...GPU_LAYER,
          }}
          className="bg-gradient-to-r from-transparent via-white/80 to-transparent"
        />
      </div>

      {/* ─── Seam pre-glow (charge phase) ───
          Faint, narrower glow that builds during letter exit, then explodes
          outward at the split. Drawn at z-20 so it floats above shutters. */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={
          charging
            ? { scaleX: 0.45, opacity: 0.55 }
            : splitting
              ? { scaleX: [0.45, 1, 1, 1], opacity: [0.55, 1, 0.85, 0] }
              : { scaleX: 0, opacity: 0 }
        }
        transition={{
          duration: charging ? 0.85 : 1.3,
          ease: EASE_OUT,
          times: splitting ? [0, 0.18, 0.6, 1] : undefined,
        }}
        style={{
          transformOrigin: "50% 50%",
          ...GPU_LAYER,
        }}
        className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_24px_rgba(255,255,255,0.95),0_0_70px_rgba(255,255,255,0.5)] z-20"
      />

      {/* ─── Radial flash at the moment of split ───
          A wide radial gradient that briefly blooms from the center at the
          instant the shutters part. Adds a punch of light that reads as the
          page underneath being unveiled. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4 }}
        animate={
          splitting
            ? { opacity: [0, 0.9, 0], scale: [0.4, 1.3, 1.8] }
            : { opacity: 0, scale: 0.4 }
        }
        transition={{
          duration: 1.1,
          ease: EASE_OUT,
          times: [0, 0.18, 1],
        }}
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(180,160,255,0.5) 22%, transparent 60%)",
          ...GPU_LAYER,
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vw] max-w-[1400px] max-h-[1400px] rounded-full mix-blend-screen z-[15] pointer-events-none"
      />
    </div>
  );
}
