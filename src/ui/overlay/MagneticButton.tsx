"use client";

import type { ReactNode, RefObject } from "react";
import { motion } from "framer-motion";
import { useMagnetic } from "@/hooks/useMagnetic";

interface MagneticButtonProps {
  children: ReactNode;
  href?: string;
}

/**
 * CTA with magnetic-hover physics — the button (and its label, at a softer
 * strength for parallax) lean toward the cursor, then spring back on leave.
 */
export function MagneticButton({ children, href = "#" }: MagneticButtonProps) {
  const outer = useMagnetic(0.4, 150);
  const inner = useMagnetic(0.18, 150);

  const onPointerMove = (e: React.PointerEvent) => {
    outer.onPointerMove(e);
    inner.onPointerMove(e);
  };
  const onPointerLeave = () => {
    outer.onPointerLeave();
    inner.onPointerLeave();
  };

  return (
    <motion.a
      ref={outer.ref as RefObject<HTMLAnchorElement>}
      href={href}
      className="magnetic-cta"
      data-cursor-label="REQUEST"
      style={{ x: outer.x, y: outer.y }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      whileTap={{ scale: 0.96 }}
    >
      <motion.span style={{ x: inner.x, y: inner.y }}>{children}</motion.span>
    </motion.a>
  );
}
