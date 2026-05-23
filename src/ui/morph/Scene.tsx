"use client";

import { useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { Vector2 } from "three";
import { OrbToWaveParticles } from "./OrbToWaveParticles";
import { BackgroundMesh } from "./BackgroundMesh";
import { scrollStore } from "./store";

// Stable module-level reference — prevents React from re-serializing a Three.js
// object as a JSX prop on every render (which would throw "circular structure" errors)
const ZERO_OFFSET = new Vector2(0, 0);

/**
 * Camera dolly — reads `scrollState` (0 → 3) every frame and moves the
 * camera through four distinct vantage points, one per section:
 *
 *   0  Orb        z=6.0, y= 0.0  —  wide framing, ring centred
 *   1  Horizon    z=4.2, y= 1.1  —  pushed forward, slight downward look
 *   2  NodeClust  z=3.8, y= 0.3  —  zoomed in, clusters fill frame
 *   3  Abyss      z=5.0, y=-1.0  —  pulled back, looking down into rain
 *
 * Uses piecewise linear interpolation between keyframes — Lenis's exponential
 * easing already provides the cinematic smoothing, so no extra dampening is
 * needed here.
 */
function CameraRig() {
  const { camera } = useThree();
  useFrame(() => {
    const { scrollState, isPricing } = scrollStore.getState();
    // On /pricing: pin camera to the NodeClusters vantage (ss=2.0) so the
    // three city clusters are centred in frame behind the pricing cards.
    const ss = isPricing ? 2.0 : scrollState;
    const s  = Math.max(0, Math.min(3, ss));

    // Camera keyframes indexed by scroll state integer (0, 1, 2, 3)
    const camZ  = [6.0, 4.2, 3.8, 5.0];
    const camY  = [0.0, 1.1, 0.3, -1.0];
    const lookY = [0.0, 0.1, 0.0, -0.3];

    const seg = Math.min(Math.floor(s), 2); // segment 0, 1, or 2
    const t   = s - seg;                    // local progress 0 → 1 within segment
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    camera.position.z = lerp(camZ[seg],  camZ[seg + 1],  t);
    camera.position.y = lerp(camY[seg],  camY[seg + 1],  t);
    camera.lookAt(0,    lerp(lookY[seg], lookY[seg + 1], t), 0);
  });
  return null;
}

/**
 * ChromaticAberration with two-layer driving:
 *
 *   1. Velocity layer (always active):
 *      Lenis scroll velocity → tiny offset (0–0.005). Fast scrolling splits
 *      the bloomed neon edges into RGB channels, eases back when still.
 *
 *   2. Transition boost (Nodes → Abyss, scrollState 2→3):
 *      As scrollState enters the 2→3 segment, the chromatic offset spikes
 *      dramatically (up to 5× base) following a sin bell-curve that peaks
 *      at scrollState ≈ 2.5.  The "glitch pulse" adds a periodic high-freq
 *      flutter at ~10 Hz when the boost is above 30 % — this creates the
 *      "chromatic separation and dissolve" aesthetic for the Abyss transition
 *      without needing any additional post-FX passes.
 */
function VelocityAberration() {
  const ref = useRef<{ offset: Vector2 } | null>(null);
  const offsetRef = useRef(new Vector2(0, 0));

  useFrame((_, dt) => {
    if (!ref.current) return;
    const { velocity, scrollState } = scrollStore.getState();

    // ── Layer 1: base velocity aberration ───────────────────────────────
    const vTarget = Math.min(Math.abs(velocity) * 0.0008, 0.005);

    // ── Layer 2: Nodes→Abyss chromatic boost ────────────────────────────
    const chromaT     = Math.max(0, Math.min(1, scrollState - 2.0));
    const chromaBoost = Math.sin(chromaT * Math.PI);  // bell curve, peak at ss≈2.5
    // High-frequency pulse: ~10 Hz flicker when boost > 30 %
    const glitchPulse = chromaBoost > 0.3
      ? Math.abs(Math.sin(performance.now() * 0.010)) * chromaBoost * 0.007
      : 0;

    const target = Math.min(vTarget * (1.0 + chromaBoost * 5.0) + glitchPulse, 0.030);
    const damp   = Math.min(1, dt * 10);
    offsetRef.current.x += (target - offsetRef.current.x) * damp;
    offsetRef.current.y  = offsetRef.current.x;
    ref.current.offset.copy(offsetRef.current);
  });

  return (
    <ChromaticAberration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      blendFunction={BlendFunction.NORMAL}
      offset={ZERO_OFFSET}
      radialModulation={false}
      modulationOffset={0}
    />
  );
}

/**
 * AdaptiveBloom — wraps the Bloom pass and dips intensity 60 % during the
 * Horizon→Nodes transition (scrollState 1→2) to prevent the "overly bright
 * blob" artefact at the midpoint.
 *
 * Bell-curve: intensity = 3.5 × (1 − 0.60 × sin(raw12 × π))
 * Minimum ≈ 1.40 at ss=1.5; full 3.5 outside ss ∈ [1, 2].
 */
function AdaptiveBloom() {
  const bloomRef = useRef<{ intensity: number } | null>(null);

  useFrame(() => {
    if (!bloomRef.current) return;
    const { scrollState, isPricing } = scrollStore.getState();

    // On /pricing: calm ambient bloom — no transition dip needed, just a
    // restrained intensity so the city clusters glow softly behind the cards.
    if (isPricing) {
      bloomRef.current.intensity = 1.2;
      return;
    }

    // Layer 1: Horizon→Nodes transition dip — bell-curve peak at ss=1.5.
    const raw12 = Math.max(0, Math.min(1, scrollState - 1.0));
    const transitionDim = 1.0 - 0.60 * Math.sin(raw12 * Math.PI);

    // Layer 2: Cluster rest-state restraint — ss ∈ [1.5, 2.5], peak at ss=2.
    // Even with reduced halo seeds in BackgroundMesh, Bloom at 3.5 could still
    // inflate the tight halos into a purple fog; keep intensity at ≈2.1 here.
    const clusterWindow = Math.max(0, 1.0 - Math.abs(scrollState - 2.0) / 0.5);
    const clusterDim    = 1.0 - 0.40 * clusterWindow;

    bloomRef.current.intensity = 3.5 * transitionDim * clusterDim;
  });

  return (
    <Bloom
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={bloomRef as any}
      // luminanceThreshold raised 0.35 → 0.55: the effective bloom window is
      // now 0.45–0.65 (with smoothing 0.20).  Neon cyan (luminance ≈ 0.71)
      // and neon purple (≈ 0.30) at full particle alpha still both trigger
      // bloom.  More importantly, the near-black background (0.0 after shader
      // fix) can NEVER reach 0.45 via mipmapBlur mip-chain accumulation.
      luminanceThreshold={0.55}
      luminanceSmoothing={0.20}
      intensity={3.5}
      radius={0.50}
      mipmapBlur
    />
  );
}

/**
 * Scene — the single fixed-position WebGL surface that paints the full page.
 *
 *   z-0 · pointer-events-none · full viewport
 *   DPR clamped to [1, 1.5] so mobile GPUs don't overheat
 *
 * Render layers (back → front, draw order via renderOrder):
 *   -100  BackgroundMesh — fullscreen clip-space quad, camera-independent.
 *          Atmospheric colours per scroll state, noise-torn liquid boundaries,
 *          ambient glow halos, chromatic glitch overlay.  Opaque (alpha=1)
 *          so all CSS backgrounds behind the canvas are completely hidden.
 *
 *     0   OrbToWaveParticles — 12 k instanced billboard particles.
 *          AdditiveBlending + depthWrite:false → adds light on top of the
 *          background without z-fighting.
 *
 * Post FX chain (EffectComposer):
 *     1. Bloom — luminanceThreshold 0.05, intensity 3.5, mipmapBlur.
 *          Captures BackgroundMesh glows (horizon line, cluster halos) and
 *          fans them out 10–20× their painted radius.  Melds particle tips
 *          into continuous glowing tubes.
 *     2. VelocityAberration — velocity-driven RGB split + Nodes→Abyss boost.
 *     3. Vignette — subtle edge darkening for cinema framing.
 */
export function Scene() {
  return (
    <div id="three-scene" className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50, near: 0.1, far: 100 }}
        gl={{
          antialias:         true,
          // alpha: false → opaque framebuffer.  BackgroundMesh fills 100 % of
          // the viewport at renderOrder -100, so no DOM background bleeds
          // through.  With alpha:true the browser's compositor can blend the
          // canvas against the body's #0a0a0a — that subtlety is a second
          // source of perceived gray on top of the shader's own COL_VOID.
          alpha:             false,
          powerPreference:   "high-performance",
        }}
        // Belt-and-suspenders: force the WebGL clear colour to absolute black
        // so the renderer's own buffer clear never contributes gray, even
        // before BackgroundMesh paints its first pixel.
        onCreated={({ gl }) => gl.setClearColor(0x000000, 1)}
        dpr={[1, 1.5]}
        style={{ background: "#000000" }}
      >
        <CameraRig />
        {/* Background renders first (renderOrder=-100) — always fills screen */}
        <BackgroundMesh />
        <OrbToWaveParticles />

        <EffectComposer>
          <AdaptiveBloom />
          <VelocityAberration />
          <Vignette eskil={false} offset={0.15} darkness={0.55} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
