"use client";

import { type ReactNode, type MouseEvent } from "react";
import { pageTransition } from "./pageTransition";
import { scrollStore } from "@/ui/morph/store";

interface TransitionLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

/**
 * Drop-in <a> that triggers the global Hyperspace Warp animation before
 * navigating.  Use for all internal route links (/pricing, /).
 *
 * Clicking spikes `scrollStore.velocity` so VelocityAberration fires the
 * chromatic-aberration burst — a subtle but premium detail that makes the
 * departure feel like a physics event, not a button press.
 */
export function TransitionLink({ href, children, className }: TransitionLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    // Spike chromatic aberration for the warp launch feel
    scrollStore.setState({ velocity: 900 });
    setTimeout(() => scrollStore.setState({ velocity: 0 }), 900);
    pageTransition.navigate(href);
  };

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
