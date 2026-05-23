"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { scrollStore } from "./store";
import { _lenisScroll, _lenisLimit } from "@/ui/site/GlobalScrollSync";

// ── GLSL: Ashima simplex-3D noise (MIT) ──────────────────────────────────────
// Identical copy shared with OrbToWaveParticles — each ShaderMaterial compiles
// its own GLSL program, so there is no runtime cost to having the source twice.
const SIMPLEX_3D = /* glsl */ `
  vec3 mod289v3(vec3 x)  { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289v4(vec4 x)  { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute4(vec4 x)  { return mod289v4(((x * 34.0) + 10.0) * x); }
  vec4 taylorInvSqrt4(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0);
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289v3(i);
    vec4 p = permute4(permute4(permute4(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4  j  = p - 49.0 * floor(p * ns.z * ns.z);
    vec4  x_ = floor(j  * ns.z);
    vec4  y_ = floor(j  - 7.0 * x_);
    vec4  x  = x_ * ns.x + ns.yyyy;
    vec4  y  = y_ * ns.x + ns.yyyy;
    vec4  h  = 1.0 - abs(x) - abs(y);
    vec4 b0  = vec4(x.xy, y.xy);
    vec4 b1  = vec4(x.zw, y.zw);
    vec4 s0  = floor(b0) * 2.0 + 1.0;
    vec4 s1  = floor(b1) * 2.0 + 1.0;
    vec4 sh  = -step(h, vec4(0.0));
    vec4 a0  = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1  = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0  = vec3(a0.xy, h.x);
    vec3 p1v = vec3(a0.zw, h.y);
    vec3 p2  = vec3(a1.xy, h.z);
    vec3 p3  = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt4(vec4(dot(p0,p0),dot(p1v,p1v),dot(p2,p2),dot(p3,p3)));
    p0 *= norm.x; p1v *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.5 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m*m, vec4(dot(p0,x0),dot(p1v,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

// ── Vertex shader — clip-space fullscreen quad ────────────────────────────────
/**
 * PlaneGeometry(2,2) corners sit exactly at NDC (±1, ±1).
 * Setting gl_Position = vec4(position.xy, 0.0, 1.0) bypasses the camera
 * completely — the quad always fills the viewport regardless of camera dolly.
 * uv from PlaneGeometry goes [0,0]→[1,1], matching CSS screen-space UV.
 */
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// ── Fragment shader — 4-state atmospheric background ─────────────────────────
/**
 * Atmospheric background for all four page sections, driven by uScrollState.
 *
 * Each section has its own "mood" (base dark + accent glow):
 *   0  Void    — pure black #000000, no ambient glow
 *   1  Horizon — deep teal-black, cyan bloom rising from the bottom edge
 *   2  Nodes   — deep violet-black, three radial halos at cluster positions
 *   3  Abyss   — near-pure black, last traces of teal fade to void
 *
 * Transition architecture:
 *   0→1  Global atmospheric fade (noise-nudged smoothstep)
 *   1→2  Liquid horizontal boundary:
 *          Nodes-purple fills from the BOTTOM, pushing horizon-cyan upward.
 *          The boundary line is warped by simplex noise → organic tearing/melting.
 *   2→3  Chromatic dissolve:
 *          The purple field breaks apart with RGB separation and digital-stutter
 *          scanlines before dissolving into the abyss. Higher-frequency noise
 *          and stepped time (18 fps) create a "glitch frame" aesthetic.
 *
 * Bloom interaction:
 *   The ambient glows (horizon cyan line, cluster halos) are intentionally
 *   above luminanceThreshold=0.05 so Bloom bleeds them into the surrounding
 *   dark space — the actual glow is much wider than what the shader draws.
 */
const FRAG = /* glsl */ `
  ${SIMPLEX_3D}

  uniform float uScrollState;
  uniform float uTime;

  varying vec2 vUv;

  const float PI = 3.14159265359;

  // ── Section base atmosphere colours ─────────────────────────────────────
  // COL_VOID / COL_ABYSS are intentionally pure black (0,0,0).  Any non-zero
  // value here is rendered as a visible gray fog by the post-processing stack
  // (mipmapBlur Bloom lifts minimum luminance via mip-chain accumulation).
  const vec3 COL_VOID  = vec3(0.0, 0.0, 0.0);         // true black — hero + fallback
  const vec3 COL_HRZ   = vec3(0.000, 0.020, 0.034);   // dark teal-black — Data Horizon
  const vec3 COL_NODES = vec3(0.110, 0.110, 0.125);   // ~#1c1c20 — dark charcoal (pricing/contact ambient)
  const vec3 COL_ABYSS = vec3(0.0, 0.0, 0.0);         // true black — The Abyss void

  // ── Glow accent colours ──────────────────────────────────────────────────
  const vec3 GLOW_CYAN   = vec3(0.000, 0.898, 1.000);  // neon cyan
  const vec3 GLOW_PURPLE = vec3(0.541, 0.169, 0.886);  // neon purple

  void main() {
    float ss = clamp(uScrollState, 0.0, 3.0);

    // ── Two-octave noise for organic boundary distortion ─────────────────
    // Slow large-scale noise (for 1→2 horizon/nodes boundary tearing)
    float nSlow = snoise(vec3(vUv.x * 2.2 + uTime * 0.04,
                              vUv.y * 1.4,
                              uTime * 0.07));
    // Fast small-scale noise (for 2→3 glitch/chromatic dissolve)
    float nFast = snoise(vec3(vUv.x * 6.5 - uTime * 0.09,
                              vUv.y * 4.0,
                              uTime * 0.15));

    float distSlow = nSlow * 0.22;         // distortion amplitude for 1→2
    float distFast = (nSlow * 0.5 + nFast * 0.5) * 0.30;  // combined for 2→3

    // ── Transition 0→1: global atmospheric fade ──────────────────────────
    // Plain noisy smoothstep — no directional boundary, just a full-screen
    // colour shift as the Orb dissolves into the Data Horizon section.
    float t01 = smoothstep(0.25, 0.75, clamp(ss, 0.0, 1.0) + nSlow * 0.10);
    vec3  bg   = mix(COL_VOID, COL_HRZ, t01);

    // ── Transition 1→2: liquid horizontal boundary ───────────────────────
    // Purple fills from the BOTTOM of the screen, displacing cyan upward.
    // boundary12 = progress through this transition [0,1].
    //   boundary12 = 0 → bottom of screen is still horizon (barely any nodes)
    //   boundary12 = 1 → top of screen is now nodes (horizon fully displaced)
    float prog12     = clamp(ss - 1.0, 0.0, 1.0);
    float boundary12 = prog12;
    float distY12    = vUv.y + distSlow;   // noise-torn Y coordinate
    // blend12: 1 → horizon, 0 → nodes
    float blend12 = smoothstep(boundary12 - 0.13, boundary12 + 0.13, distY12);
    vec3  bg12    = mix(COL_NODES, COL_HRZ, blend12);

    // ── Transition 2→3: chromatic dissolve to abyss ──────────────────────
    // Same bottom-fill mechanic but with higher-frequency distortion so the
    // boundary looks broken, glitched rather than a smooth liquid pour.
    float prog23     = clamp(ss - 2.0, 0.0, 1.0);
    float boundary23 = prog23;
    float distY23    = vUv.y + distFast;
    // blend23: 1 → nodes, 0 → abyss
    float blend23 = smoothstep(boundary23 - 0.15, boundary23 + 0.15, distY23);
    vec3  bg23    = mix(COL_ABYSS, COL_NODES, blend23);

    // ── Phase selectors (narrow window at integer boundaries) ────────────
    float sel12 = smoothstep(0.88, 1.12, ss);
    float sel23 = smoothstep(1.88, 2.12, ss);
    bg = mix(mix(bg, bg12, sel12), bg23, sel23);

    // ── Glow A: Cyan horizon (peaks at ss = 1) ───────────────────────────
    float horzLife = clamp(1.0 - abs(ss - 1.0) * 1.7, 0.0, 1.0);
    // Broad atmospheric bloom rising from the floor — cubic falloff upward
    float horzBloom = pow(max(0.0, 1.0 - vUv.y * 2.8), 2.5) * horzLife;
    bg += GLOW_CYAN * horzBloom * 0.055;
    // Thin bright edge line at the very bottom (y < 4 %) — Bloom fans this out
    bg += GLOW_CYAN * smoothstep(0.04, 0.0, vUv.y) * horzLife * 0.22;

    // ── Glow B: Purple node-cluster halos (peaks at ss = 2) ─────────────
    // Screen UV positions approximated for camera at ss=2 keyframe
    //   (z=3.8, y=0.3, FOV=50, aspect≈1.78):
    //   LA        world(-2.0,-0.2,-0.3) → screen ≈ (0.21, 0.44)
    //   Toronto   world( 0.0, 0.5, 0.0) → screen ≈ (0.50, 0.56)
    //   Sheffield world( 2.0,-0.1, 0.3) → screen ≈ (0.79, 0.46)
    float nodeLife = clamp(1.0 - abs(ss - 2.0) * 1.7, 0.0, 1.0);
    float dLA  = length(vUv - vec2(0.21, 0.44));
    float dYYZ = length(vUv - vec2(0.50, 0.56));
    float dSHF = length(vUv - vec2(0.79, 0.46));
    // Node background: pure void — all ambient light is emitted by the cyan
    // particle vortices via AdditiveBlending.  No purple halos; they caused
    // a muddy purple vignette that competed with the particles.
    // haloSum is retained because the 2→3 chromatic-glitch edgeMask below
    // references the cluster distance fields (dLA, dYYZ, dSHF) indirectly.
    float haloSum = exp(-dLA  * 11.0) * 0.90
                  + exp(-dYYZ * 10.0) * 1.10
                  + exp(-dSHF * 11.0) * 0.90;
    // bg += GLOW_PURPLE * haloSum * nodeLife;  // ← removed, causes purple vignette

    // ── Chromatic glitch overlay (ss 2→3 only) ───────────────────────────
    // All values depend only on uniforms → uniform conditional, GPU-efficient
    // (the entire wave takes the same branch, so no divergence penalty).
    if (prog23 > 0.04 && prog23 < 0.90) {
      float glitchEnv = sin(prog23 * PI) * 0.90;   // bell 0→peak→0
      // Step time to 18 fps — creates digital stutter / "glitch frame" feel
      float tStep  = floor(uTime * 18.0);
      float gNoise = snoise(vec3(vUv.x * 9.0, vUv.y * 5.0, tStep));
      // Affect only pixels NEAR the moving boundary (where blend23 ≈ 0.5)
      float edgeMask = (1.0 - abs(blend23 * 2.0 - 1.0))
                     * step(0.30, abs(gNoise));     // only strong-noise pixels
      float rgbAmt = gNoise * glitchEnv * edgeMask * 0.08;
      bg.r = clamp(bg.r + rgbAmt, 0.0, 1.0);       // R shifts one way
      bg.b = clamp(bg.b - rgbAmt, 0.0, 1.0);       // B shifts the other
      // Horizontal scanline flicker locked to the stepped time
      float scanline = step(0.5, fract(vUv.y * 80.0 + tStep * 0.13));
      bg += vec3(glitchEnv * edgeMask * scanline * 0.025);
    }

    // ── Radial vignette (subtle, Bloom handles hard edge darkening) ───────
    vec2  vigUv   = vUv * 2.0 - 1.0;
    float vignette = 1.0 - dot(vigUv, vigUv) * 0.24;
    bg *= vignette;

    gl_FragColor = vec4(clamp(bg, 0.0, 1.0), 1.0);
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────
/**
 * BackgroundMesh — fullscreen atmospheric shader rendered BEHIND all particles.
 *
 * Clip-space quad:
 *   · PlaneGeometry(2,2) + clip-space vertex shader → always fills the viewport,
 *     completely independent of the perspective camera's position / dolly.
 *   · renderOrder: -100 — draws before OrbToWaveParticles, which uses default 0.
 *   · depthTest: false / depthWrite: false — never touches the depth buffer, so
 *     particle additive blending composites correctly on top.
 *
 * Post-processing integration:
 *   · Because this mesh renders INTO the same R3F canvas as OrbToWaveParticles,
 *     the EffectComposer's Bloom pass captures the ambient glows (horizon line,
 *     cluster halos) and spreads them into the surrounding dark space —
 *     providing a much larger, softer glow than the shader alone would produce.
 */
export function BackgroundMesh() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const { isPricing } = scrollStore.getState();

    // ── Lenis-proof scroll injection ────────────────────────────────────────
    // Read _lenisScroll (Lenis's own eased position) rather than window.scrollY,
    // which lags when html { scroll-behavior: smooth } double-smooths every
    // window.scrollTo() Lenis issues.  Fall back to DOM measurement until the
    // first Lenis scroll event fires (_lenisLimit is still the initial 1).
    const maxScroll = Math.max(
      _lenisLimit,
      document.documentElement.scrollHeight - window.innerHeight,
      1,
    );
    const targetSS = isPricing ? 2.0 : Math.min(3.0, (_lenisScroll / maxScroll) * 3.0);

    // Lerp: factor 0.05 ≈ 250 ms exponential lag at 60 fps — keeps atmosphere
    // transitions silky and matching OrbToWaveParticles' own lerp rate.
    const ss = THREE.MathUtils.lerp(
      matRef.current.uniforms.uScrollState.value,
      targetSS,
      0.05,
    );
    matRef.current.uniforms.uScrollState.value = ss;
    matRef.current.uniforms.uTime.value        = clock.elapsedTime;
  });

  return (
    <mesh renderOrder={-100}>
      {/* 2×2 in local space → clip-space corners at (±1, ±1) */}
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={{
          uScrollState: { value: 0 },
          uTime:        { value: 0 },
        }}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
