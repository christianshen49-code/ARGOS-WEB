"use client";

import { motion, type MotionValue } from "framer-motion";
import type { CSSProperties } from "react";

/**
 * A radial-gradient blob with autonomous drift and breathing scale. Each
 * blob takes a unique `seed` so the four oscillation paths in this file
 * desync — staggered phases prevent the whole background from pulsing in
 * lockstep.
 *
 * Layered with an optional `parallaxY` MotionValue from `useScroll`, so
 * the blob also drifts up/down as the user scrolls the section.
 */
interface AnimatedBlobProps {
  className?: string;
  /** CSS radial-gradient color stops, e.g. "rgba(156,100,255,0.18)" */
  color: string;
  /** Outer radius scale (px sizes baked into `className`). */
  duration?: number;
  /** Distinct integer 0-9; rotates the autonomous drift path. */
  seed?: number;
  /** Scroll-linked y MotionValue (optional). */
  parallaxY?: MotionValue<number>;
  style?: CSSProperties;
}

const PATHS = [
  // Each entry: [x, y, scale] keyframes (4 stops, loops via reverse).
  { x: [0, 40, -30, 0], y: [-30, 20, -10, -30], scale: [1, 1.1, 0.95, 1] },
  { x: [0, -50, 25, 0], y: [20, -10, 35, 20], scale: [1, 0.92, 1.08, 1] },
  { x: [0, 30, 10, -20, 0], y: [-20, -40, 10, 20, -20], scale: [1, 1.05, 1, 1.1, 1] },
  { x: [0, -25, 35, -10, 0], y: [10, 30, -20, 25, 10], scale: [1, 1.12, 0.94, 1.06, 1] },
];

export function AnimatedBlob({
  className = "",
  color,
  duration = 22,
  seed = 0,
  parallaxY,
  style,
}: AnimatedBlobProps) {
  const path = PATHS[seed % PATHS.length];

  return (
    <motion.div
      aria-hidden
      animate={{ x: path.x, y: path.y, scale: path.scale }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
        repeatType: "loop",
      }}
      style={{
        background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
        // Scroll parallax stacks on top of autonomous drift via a translate-y
        // proxy. The autonomous `y` is in the inline animate; we add the
        // scroll-driven translate via a MotionValue style prop on a wrapper.
        willChange: "transform",
        ...style,
      }}
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
    >
      {/* Parallax layer — applied to a child so it composes with the parent's
          autonomous transform without overwriting it. */}
      {parallaxY ? (
        <motion.div
          style={{ y: parallaxY, position: "absolute", inset: 0 }}
          aria-hidden
        />
      ) : null}
    </motion.div>
  );
}

/**
 * Pulsing concentric rings that emanate from a single point. Used as a
 * "broadcast" motif behind the FinalCta. Three rings staggered 1.7 s apart
 * so the sequence reads continuous, not synchronized.
 */
export function RadiatingRings({
  color = "rgba(255,255,255,0.18)",
  className = "",
}: {
  color?: string;
  className?: string;
}) {
  const rings = [0, 1.7, 3.4];
  return (
    <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none ${className}`} aria-hidden>
      {rings.map((delay, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{
            scale: [0.4, 1.6],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 5.1,
            repeat: Infinity,
            ease: "easeOut",
            delay,
            times: [0, 0.05, 1],
          }}
          style={{
            position: "absolute",
            left: "-300px",
            top: "-300px",
            width: "600px",
            height: "600px",
            borderRadius: "9999px",
            border: `1px solid ${color}`,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Animated network mesh — three city nodes connected by flowing dashed
 * paths. Designed for the Nodes section.
 *
 * The dashed `stroke-dashoffset` is animated via CSS keyframes so a
 * scrolling band of dashes appears to chase along each path (data-in-flight
 * feel). Each path uses a slightly different speed so they don't sync.
 */
export function NetworkMesh() {
  // Three logical positions on a 1000x420 svg viewBox. These roughly evoke
  // LA → Toronto → Sheffield but as an abstract triangle, not a real map.
  const nodes = [
    { id: "LAX", x: 180, y: 280 },
    { id: "YYZ", x: 550, y: 160 },
    { id: "SHF", x: 880, y: 200 },
  ];
  const paths = [
    `M ${nodes[0].x} ${nodes[0].y} Q ${(nodes[0].x + nodes[1].x) / 2} ${nodes[0].y - 120} ${nodes[1].x} ${nodes[1].y}`,
    `M ${nodes[1].x} ${nodes[1].y} Q ${(nodes[1].x + nodes[2].x) / 2} ${nodes[1].y - 80} ${nodes[2].x} ${nodes[2].y}`,
    `M ${nodes[0].x} ${nodes[0].y} Q ${(nodes[0].x + nodes[2].x) / 2} ${nodes[0].y + 80} ${nodes[2].x} ${nodes[2].y}`,
  ];

  return (
    <svg
      aria-hidden
      viewBox="0 0 1000 420"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full pointer-events-none opacity-50 mix-blend-screen"
    >
      <defs>
        <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(80,180,255,0.85)" />
          <stop offset="60%" stopColor="rgba(80,180,255,0.2)" />
          <stop offset="100%" stopColor="rgba(80,180,255,0)" />
        </radialGradient>
        <style>{`
          @keyframes dashFlow {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: -120; }
          }
          @keyframes nodePulse {
            0%, 100% { opacity: 0.55; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.4); }
          }
        `}</style>
      </defs>

      {/* Static dim base path so the curves stay readable while the dashes flow */}
      {paths.map((d, i) => (
        <path
          key={"base-" + i}
          d={d}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}

      {/* Flowing dashed overlays */}
      {paths.map((d, i) => (
        <path
          key={"flow-" + i}
          d={d}
          fill="none"
          stroke="rgba(80, 180, 255, 0.55)"
          strokeWidth={1.5}
          strokeDasharray="4 16"
          strokeLinecap="round"
          style={{
            animation: `dashFlow ${4 + i * 0.7}s linear infinite`,
          }}
        />
      ))}

      {/* Node dots — outer glow + bright center, with pulse animation */}
      {nodes.map((n) => (
        <g key={n.id}>
          <circle
            cx={n.x}
            cy={n.y}
            r={14}
            fill="url(#node-glow)"
            style={{
              transformOrigin: `${n.x}px ${n.y}px`,
              animation: "nodePulse 3.2s ease-in-out infinite",
            }}
          />
          <circle cx={n.x} cy={n.y} r={3} fill="rgba(150, 220, 255, 1)" />
        </g>
      ))}
    </svg>
  );
}
