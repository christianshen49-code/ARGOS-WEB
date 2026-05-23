"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Vertex shader ─────────────────────────────────────────────────────────────
/**
 * Passes UV coordinates and applies a subtle cylindrical warp.
 * Edges bend slightly away from the viewer (negative Z offset proportional
 * to X² and Y²) giving the flat plane a faint "cosmic bowl" depth without
 * a high segment count.
 */
const VERT = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;

    vec3 pos = position;
    // Barrel warp — corners recede ~1.8 cm at extreme (±1 NDC)
    pos.z -= (position.x * position.x) * 0.018;
    pos.z -= (position.y * position.y) * 0.010;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// ── Fragment shader ───────────────────────────────────────────────────────────
/**
 * Holographic / Cyber treatment pipeline:
 *
 *   1. Sample the VideoTexture.
 *   2. Extract BT.709 luminance to flatten the video to a single channel.
 *   3. Map luminance → duotone: deep violet (shadows) → neon cyan (highlights).
 *   4. Overlay a fine scanline grid — sin(uv.y * 480 + uTime*1.6) at ±2.5%
 *      amplitude.  Reads as a CRT / live-data-feed aesthetic; subtle enough
 *      to not distract.
 *   5. Radial alpha mask via two smoothstep calls:
 *        · Circular: full opacity at centre, fades to 0 at ~unit circle
 *        · Vertical: tapers the top and bottom edges independently so the
 *          glow lingers behind the three city cards (horizontal mid-band)
 *          without bleeding into the heading text above or the page below.
 *   6. Multiply final alpha by uOpacity (GSAP-driven, 0 → 0.4 on scroll).
 */
const FRAG = /* glsl */ `
  uniform sampler2D uVideo;
  uniform float     uTime;
  uniform float     uOpacity;

  varying vec2 vUv;

  void main() {
    // ── 1. Video sample ────────────────────────────────────────────────
    vec4 vid = texture2D(uVideo, vUv);

    // ── 2. Luminance (BT.709 coefficients) ────────────────────────────
    float luma = dot(vid.rgb, vec3(0.2126, 0.7152, 0.0722));

    // Lift shadows slightly so very dark footage still shows the violet tint
    luma = luma * 0.85 + 0.08;

    // ── 3. Duotone: #1A0033 (deep violet) → #00E5FF (neon cyan) ───────
    vec3 shadowCol = vec3(0.102, 0.000, 0.200);  // dark violet
    vec3 hiCol     = vec3(0.000, 0.898, 1.000);  // neon cyan #00E5FF
    vec3 duotone   = mix(shadowCol, hiCol, luma);

    // ── 4. Scanlines ────────────────────────────────────────────────────
    // Fine horizontal lines (480 lines/unit) scrolling at 1.6 rad/s.
    // Amplitude ±0.025 → barely perceptible as texture, not distraction.
    float scan = sin(vUv.y * 480.0 + uTime * 1.6) * 0.025 + 0.975;
    duotone *= scan;

    // Add a secondary coarser horizontal grid for a "data-feed" feeling
    float coarse = sin(vUv.y * 80.0 - uTime * 0.4) * 0.012 + 0.988;
    duotone *= coarse;

    // ── 5. Radial alpha mask ────────────────────────────────────────────
    vec2  c    = vUv * 2.0 - 1.0;           // remap [0,1]² → [-1,1]²
    float dist = length(c);

    // Circular mask: full opacity to ~0.35 radius, fully transparent at 1.1
    float radial = 1.0 - smoothstep(0.35, 1.10, dist);

    // Vertical taper: soften top third and bottom third so glow is centred
    // on the card row rather than spreading to heading text or footer.
    float vertTaper = 1.0 - smoothstep(0.28, 0.82, abs(c.y));

    // Horizontal feather: slight additional fade at left/right extremes
    float horzTaper = 1.0 - smoothstep(0.55, 1.05, abs(c.x));

    float mask = radial * vertTaper * horzTaper;

    // ── 6. Final colour + opacity ────────────────────────────────────────
    gl_FragColor = vec4(duotone, mask * uOpacity);
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────

interface HoloVideoMeshProps {
  /** Ref to the live VideoTexture from useHLSVideo. May be null while loading. */
  textureRef: React.RefObject<THREE.VideoTexture | null>;
  /** GSAP-tweened opacity target { current: 0..1 }. */
  opacityRef: React.MutableRefObject<number>;
}

/**
 * HoloVideoMesh
 *
 * A large curved PlaneGeometry sitting at Z=0 with a custom ShaderMaterial
 * that treats the HLS VideoTexture as a holographic data-cloud:
 *
 *   · Plane: 20×12 world units — oversized so the radial mask handles
 *     edge blending at any section aspect ratio, avoiding hard clip lines.
 *   · 48×30 segments feed the barrel-warp vertex shader smooth curvature.
 *   · AdditiveBlending: adds cyan light to the #0a0a0a background; dark
 *     parts of the video contribute effectively zero — only bright parts
 *     create visible glow.
 *   · depthWrite: false — prevents z-fighting with transparent DOM layers.
 *
 * The component hot-swaps the `uVideo` uniform from the 1×1 fallback to
 * the live VideoTexture once hls.js finishes loading; no re-mount needed.
 */
export function HoloVideoMesh({ textureRef, opacityRef }: HoloVideoMeshProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // 1×1 black fallback — shader has a valid sampler before HLS loads.
  // Deep violet tint via the duotone at luma=0 shows a very faint violet
  // glow before video decode starts, which is a pleasant pre-load state.
  const fallback = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    t.needsUpdate = true;
    return t;
  }, []);

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;

    // Advance time uniform
    u.uTime.value = clock.elapsedTime;

    // GSAP writes to opacityRef.current each frame via its own ticker;
    // read directly — no React state, no re-render.
    u.uOpacity.value = opacityRef.current;

    // Hot-swap: once VideoTexture is ready, swap out the fallback.
    // Check by reference — O(1) per frame.
    const live = textureRef.current;
    if (live && u.uVideo.value !== live) {
      u.uVideo.value = live;
    }
  });

  return (
    <mesh position={[0, 0, 0]}>
      {/*
        48×30 segments give the barrel-warp vertex shader smooth curvature
        across the full 20-unit width.  Subdivisions are cheap here since
        it's a single static mesh (no per-frame position updates).
      */}
      <planeGeometry args={[20, 12, 48, 30]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={{
          uVideo:   { value: fallback },
          uTime:    { value: 0 },
          uOpacity: { value: 0 },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}
