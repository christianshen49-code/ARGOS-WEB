"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

/**
 * SynapticLoader — the "Synaptic Growth" preloader for the Pricing page.
 *
 * Visual metaphor: cell mitosis.
 *   Phase 0 — dormant:  a single glowing cyan node pulses at the viewport centre
 *   Phase 1 — dividing: the node splits into three via high-stiffness springs,
 *                       forming the three pricing tiers (Professional · Enterprise · Elite)
 *   Phase 2 — exiting:  the whole assembly fades out, revealing the page content
 *
 * Spring physics: stiffness:100 damping:20 — matches the spec for organic mitosis.
 * Connector lines draw outward from the origin simultaneously, giving the
 * appearance of synaptic fibres extending as the nodes separate.
 */

const SPRING = { type: "spring" as const, stiffness: 100, damping: 20 };

const NODES = [
  { label: "Professional", x: -220, y: 18,  accent: false, delay: 0.00 },
  { label: "Enterprise",   x:    0, y: -38, accent: true,  delay: 0.07 },
  { label: "Elite",        x:  220, y: 18,  accent: false, delay: 0.14 },
] as const;

interface SynapticLoaderProps {
  onComplete: () => void;
}

export function SynapticLoader({ onComplete }: SynapticLoaderProps) {
  const [dividing, setDividing] = useState(false);
  const [visible,  setVisible]  = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setDividing(true),   380);
    const t2 = setTimeout(() => setVisible(false),  1500);
    const t3 = setTimeout(() => onComplete(),       1880);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="synaptic"
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.38, ease: "easeOut" } }}
          aria-hidden
        >
          {/* ── Origin node (stays at centre, dims as children divide) ────── */}
          <motion.div
            className="absolute w-3 h-3 rounded-full"
            style={{ background: "#00e5ff", boxShadow: "0 0 28px 10px rgba(0,229,255,0.5)" }}
            initial={{ scale: 0, opacity: 0 }}
            animate={
              dividing
                ? { scale: 0.35, opacity: 0.30 }
                : { scale: 1,    opacity: 1    }
            }
            transition={SPRING}
          />

          {/* ── Connector fibres (draw from origin toward each child) ─────── */}
          {NODES.map((n, i) => {
            const len   = Math.sqrt(n.x * n.x + n.y * n.y);
            const angle = Math.atan2(n.x, -n.y) * (180 / Math.PI);
            return (
              <motion.div
                key={`line-${i}`}
                className="absolute"
                style={{
                  width: "1px",
                  height: len,
                  left: "calc(50% - 0.5px)",
                  top: "50%",
                  transformOrigin: "top center",
                  rotate: `${angle}deg`,
                  background:
                    "linear-gradient(to bottom, rgba(0,229,255,0.45) 0%, transparent 100%)",
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={dividing ? { scaleY: 1, opacity: 0.55 } : { scaleY: 0, opacity: 0 }}
                transition={{ ...SPRING, delay: n.delay + 0.06 }}
              />
            );
          })}

          {/* ── Child nodes spring from origin position ───────────────────── */}
          {NODES.map((n, i) => (
            <motion.div
              key={`node-${i}`}
              className="absolute flex flex-col items-center gap-2.5"
              initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
              animate={
                dividing
                  ? { x: n.x, y: n.y, scale: 1, opacity: 1 }
                  : { x: 0,   y: 0,   scale: 0, opacity: 0 }
              }
              transition={{ ...SPRING, delay: n.delay }}
            >
              {/* Node dot */}
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: n.accent ? "#00e5ff" : "rgba(255,255,255,0.65)",
                  boxShadow: n.accent
                    ? "0 0 14px 4px rgba(0,229,255,0.65)"
                    : "0 0 7px 2px rgba(255,255,255,0.25)",
                }}
              />
              {/* Label fades in slightly after the spring settles */}
              <motion.span
                className="text-[9px] tracking-[0.30em] uppercase font-mono whitespace-nowrap"
                initial={{ opacity: 0 }}
                animate={dividing ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.28, delay: n.delay + 0.28 }}
                style={{
                  color: n.accent ? "rgba(0,229,255,0.85)" : "rgba(255,255,255,0.40)",
                }}
              >
                {n.label}
              </motion.span>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
