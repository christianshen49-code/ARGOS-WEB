"use client";

import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { HoloVideoMesh } from "./HoloVideoMesh";

interface NodeCanvasProps {
  textureRef: React.RefObject<THREE.VideoTexture | null>;
  opacityRef: React.MutableRefObject<number>;
}

/**
 * NodeCanvas — isolated R3F WebGL context scoped to the #nodes section.
 *
 * Kept separate from the page-level <Scene> canvas so the VideoTexture
 * lifecycle is entirely local to this section (mount → decode → unmount →
 * dispose).  Two simultaneous WebGL contexts are well within browser limits
 * (typically 8–16).
 *
 * Camera: perspective, FOV 50, Z=3.
 *   At this distance the frustum half-height at Z=0 is ~2.8 world units.
 *   HoloVideoMesh uses a 20×12 plane — larger than any frustum, so the
 *   radial alpha mask handles blending at all viewport aspect ratios.
 *
 * Rendering notes:
 *   · alpha: true   — transparent canvas background; global <Scene> / DOM
 *                     sections show through (correct compositing order)
 *   · antialias: false — not needed for a blurred, glowing video overlay
 *   · dpr={1}       — fixed; video quality doesn't benefit from 2× DPR
 *   · powerPreference: "default" — don't compete with the page-level canvas
 *     for the "high-performance" GPU tier
 */
export function NodeCanvas({ textureRef, opacityRef }: NodeCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3], fov: 50, near: 0.1, far: 20 }}
      gl={{
        antialias: false,
        alpha: true,
        powerPreference: "default",
      }}
      dpr={1}
      style={{ background: "transparent", width: "100%", height: "100%" }}
    >
      <HoloVideoMesh textureRef={textureRef} opacityRef={opacityRef} />
    </Canvas>
  );
}
