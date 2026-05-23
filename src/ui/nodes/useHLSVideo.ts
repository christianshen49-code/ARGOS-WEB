"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const HLS_SRC =
  "https://stream.mux.com/BuGGTsiXq1T00WUb8qfURrHkTCbhrkfFLSv4uAOZzdhw.m3u8";

/**
 * Creates a hidden <video> element, loads the Mux HLS stream via hls.js
 * (or native HLS on Safari), and returns a stable THREE.VideoTexture ref.
 *
 * Architecture:
 *
 *   · `video` is created inside `useMemo` — runs once on the client, never
 *     on the server (typeof window guard). The element is appended to
 *     <body> off-screen rather than display:none because some browsers
 *     suspend hardware decode for hidden elements.
 *
 *   · `VideoTexture` is created synchronously from the same `video` ref so
 *     the R3F shader always has a valid sampler on frame 0.  Three.js polls
 *     `video.readyState` internally — when the stream begins decoding the
 *     texture auto-updates with no extra code.
 *
 *   · HLS.js is loaded lazily via dynamic import (browser-only, never SSR
 *     bundle). The attach + play sequence happens in `useEffect`.
 *
 *   · Full cleanup: HLS destroyed, video src cleared, texture disposed,
 *     DOM node removed — no leaks across HMR cycles or navigation.
 */
export function useHLSVideo(): React.RefObject<THREE.VideoTexture | null> {
  // ── 1. Create the <video> element ────────────────────────────────────────
  // Stable across re-renders.  SSR: returns null (typeof window guard).
  const video = useMemo<HTMLVideoElement | null>(() => {
    if (typeof window === "undefined") return null;

    const el = document.createElement("video");
    el.muted = true;
    el.loop = true;
    el.playsInline = true;
    el.setAttribute("playsinline", "true"); // belt-and-suspenders for WebKit
    el.crossOrigin = "anonymous";           // required for WebGL texture reads

    // Visually hidden but NOT display:none — keeps hardware decode active.
    // Fixed + off-screen so it's excluded from layout entirely.
    Object.assign(el.style, {
      position:      "fixed",
      top:           "-9999px",
      left:          "-9999px",
      width:         "1px",
      height:        "1px",
      opacity:       "0",
      pointerEvents: "none",
    });
    document.body.appendChild(el);
    return el;
  }, []);

  // ── 2. Wrap in VideoTexture ───────────────────────────────────────────────
  // Created once; Three.js polls video.readyState per frame and calls
  // needsUpdate internally — no manual flagging needed.
  const textureRef = useRef<THREE.VideoTexture | null>(null);

  useMemo(() => {
    if (!video || textureRef.current) return;
    const vt = new THREE.VideoTexture(video);
    vt.minFilter = THREE.LinearFilter;
    vt.magFilter = THREE.LinearFilter;
    vt.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = vt;
  }, [video]);

  // ── 3. Attach HLS stream (async, browser only) ───────────────────────────
  useEffect(() => {
    if (!video) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let hlsInstance: any = null;

    (async () => {
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;

      if (Hls.isSupported()) {
        hlsInstance = new Hls({
          maxBufferLength: 20,
          startLevel: -1, // auto quality selection
        });
        hlsInstance.loadSource(HLS_SRC);
        hlsInstance.attachMedia(video);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {
            // Autoplay blocked (e.g. strict browser policy) — defer to first
            // user interaction.  This should be rare since the video is muted.
            const retry = () => video.play().catch(() => {});
            window.addEventListener("pointerdown", retry, { once: true });
          });
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari: native HLS support
        video.src = HLS_SRC;
        video.play().catch(() => {});
      }
    })();

    // ── Cleanup ──────────────────────────────────────────────────────────
    return () => {
      cancelled = true;
      hlsInstance?.destroy();
      video.pause();
      video.src = "";
      video.load(); // flush pending decode buffer
      textureRef.current?.dispose();
      textureRef.current = null;
      video.parentNode?.removeChild(video);
    };
  }, [video]); // stable dep — fires exactly once on mount

  return textureRef;
}
