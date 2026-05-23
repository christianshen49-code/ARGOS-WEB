"use client";

import { useState } from "react";
import gsap from "gsap";

/**
 * Visual audio toggle — signature AT chrome in the bottom-left corner. Wired
 * to local state only; no real audio is played. Clicking gives a quick GSAP
 * scale-bounce so the press feels mechanical.
 */
export function AudioToggle() {
  const [on, setOn] = useState(false);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setOn((prev) => !prev);
    gsap.fromTo(
      e.currentTarget,
      { scale: 0.92 },
      { scale: 1, duration: 0.35, ease: "expo.out" },
    );
  };

  return (
    <button
      type="button"
      className="audio-toggle"
      onClick={onClick}
      data-cursor-label={on ? "MUTE" : "ENABLE"}
      aria-label="Toggle audio"
    >
      <span className="audio-dot" data-on={on ? "true" : "false"} />
      <span>{on ? "AUDIO · ON" : "AUDIO · OFF"}</span>
    </button>
  );
}
