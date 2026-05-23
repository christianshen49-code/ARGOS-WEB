"use client";

import { motion } from "framer-motion";

const NODES = [
  { name: "Los Angeles", coords: "34.0522° N · 118.2437° W" },
  { name: "Toronto", coords: "43.6532° N · 79.3832° W" },
  { name: "Sheffield", coords: "53.3811° N · 1.4701° W" },
] as const;

/**
 * Second-act DOM content — sits below the hero and is revealed as the user
 * scrolls. The companion WebGL globe (rendered in the persistent canvas)
 * dollies forward in sync via `scrollProgress`.
 */
export function NodesSection() {
  return (
    <section className="nodes-section" id="nodes">
      <div className="nodes-shell">
        <header className="nodes-eyebrow">
          <span>02 — Global Nodes</span>
        </header>

        <h2 className="nodes-title">
          Simultaneous pilots in <em>three&nbsp;cities</em>.
        </h2>

        <ul className="nodes-list">
          {NODES.map((n, i) => (
            <motion.li
              key={n.name}
              data-cursor-label="EXPLORE NODE"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20%" }}
              transition={{
                delay: 0.05 + i * 0.08,
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <strong>{n.name}</strong>
              <span>{n.coords}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
