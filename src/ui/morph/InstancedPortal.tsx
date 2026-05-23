"use client";

import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { scrollStore } from "./store";

const COUNT = 50_000;

/** Ashima/IQ simplex 3D noise — reused by curl. License: MIT. */
const SIMPLEX_3D = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+10.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0);
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

/** Curl of a 3D simplex field — yields a smooth, divergence-free flow. */
const CURL = /* glsl */ `
  vec3 curlNoise(vec3 p) {
    const float e = 0.1;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);
    float p_x0 = snoise(p - dx); float p_x1 = snoise(p + dx);
    float p_y0 = snoise(p - dy); float p_y1 = snoise(p + dy);
    float p_z0 = snoise(p - dz); float p_z1 = snoise(p + dz);
    float x = p_y1 - p_y0 - (p_z1 - p_z0);
    float y = p_z1 - p_z0 - (p_x1 - p_x0);
    float z = p_x1 - p_x0 - (p_y1 - p_y0);
    return normalize(vec3(x, y, z) + 1e-6) * (2.0 * e);
  }
`;

/**
 * Three-state vertex shader.
 *
 * State 0 — VIDEO  (uProgress 0.00 → 0.45)
 *   Particles scatter across the viewport at positions mapped from aVideoUV
 *   (random UV coords baked per-particle). The UV is passed as a varying so
 *   the fragment shader can sample the video texture for color — vertex
 *   texture fetches are intentionally avoided for broad GPU compatibility.
 *   Depth variation comes from aSeed so the video "plane" has organic parallax.
 *
 * State 1 — RING   (uProgress 0.45 → 1.00 entry)
 *   Particles converge on the glowing neon ring (aCirclePos) with curl noise
 *   displacement — the existing "portal" look.
 *
 * State 2 — HORIZON (uProgress 0.45 → 1.00 exit)
 *   Ring opens into the undulating particle horizon (aLinePos).
 */
const VERTEX_SHADER = /* glsl */ `
  ${SIMPLEX_3D}
  ${CURL}

  uniform float uTime;
  uniform float uProgress;
  uniform float uVelocity;

  // Per-instance baked attributes
  attribute vec3 aCirclePos;
  attribute vec3 aLinePos;
  attribute vec2 aVideoUV;   // random UV into the video frame
  attribute float aSeed;

  varying float vAlpha;
  varying float vMix;
  varying vec2 vQuadUv;
  varying vec2 vVideoUV;     // forwarded to fragment for video color sampling
  varying float vVideoBlend; // 0 = video color, 1 = neon color

  float easeInOutCubic(float t) {
    return t < 0.5
      ? 4.0 * t * t * t
      : 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5;
  }

  void main() {
    // ── Phase timing ──────────────────────────────────────────────────────
    // p1: video → ring  (first 45% of scroll)
    // p2: ring → horizon (last 55% of scroll)
    float p1Raw = clamp(uProgress / 0.45, 0.0, 1.0);
    float p2Raw = clamp((uProgress - 0.45) / 0.55, 0.0, 1.0);
    float p1 = easeInOutCubic(p1Raw);
    float p2 = easeInOutCubic(p2Raw);

    // ── State 0: VIDEO ────────────────────────────────────────────────────
    // Viewport-filling plane: camera at z=6, FOV=50 → at z=0:
    //   height ≈ 5.6 units, width ≈ 10.0 units (16:9)
    // aSeed drives organic Z-depth variation (no vertex tex fetch needed).
    float vidX = (aVideoUV.x - 0.5) * 10.0;
    float vidY = (0.5 - aVideoUV.y) * 5.6;
    float vidZ = (aSeed - 0.5) * 0.7;
    vec3 posVideo = vec3(vidX, vidY, vidZ);

    // ── State 1: RING ─────────────────────────────────────────────────────
    vec3 noisePos = aCirclePos * 0.35 + vec3(uTime * 0.12, uTime * 0.08, aSeed * 3.7);
    vec3 curl = curlNoise(noisePos) * 0.55;
    vec3 posCircle = aCirclePos + curl * 0.6;

    // ── State 2: HORIZON ──────────────────────────────────────────────────
    vec3 horizonNoise = vec3(aLinePos.x * 0.4 + uTime * 0.3, aSeed * 4.1, uTime * 0.15);
    float waveY = snoise(horizonNoise) * 0.55;
    vec3 posHorizon = vec3(
      aLinePos.x + curl.x * 0.3,
      aLinePos.y + waveY + curl.y * 0.18,
      aLinePos.z * 0.6 + curl.z * 0.4
    );

    // ── Three-state morph ─────────────────────────────────────────────────
    vec3 instancePos = mix(posVideo, posCircle, p1);
    instancePos      = mix(instancePos, posHorizon, p2);

    // Velocity-driven Z smear — fast scroll makes swarm feel like it has momentum
    float vSign = sign(uVelocity);
    float vMag  = clamp(abs(uVelocity), 0.0, 1.0);
    instancePos.z -= vSign * vMag * (1.0 + aSeed * 1.5) * 0.6;

    // Billboard quad in view space
    vec4 mvPos = modelViewMatrix * vec4(instancePos, 1.0);
    float size = 0.022 + aSeed * 0.018;
    mvPos.xy += position.xy * size;
    gl_Position = projectionMatrix * mvPos;

    // ── Varyings ──────────────────────────────────────────────────────────
    // In video state alpha is softened (0.4–0.9 based on seed) so the "layer"
    // looks like glowing dust rather than a solid wall of particles.
    float videoAlpha = 0.4 + 0.5 * aSeed;
    float neonAlpha  = 0.55 + 0.45 * aSeed;
    vAlpha = mix(videoAlpha, neonAlpha, p1);

    // Color mix: p2 shifts neon cyan→purple; only active once ring forms
    vMix       = p2 + 0.25 * sin(uTime * 0.5 + aSeed * 6.28);
    vVideoBlend = p1;  // 0 = full video color, 1 = full neon
    vVideoUV   = aVideoUV;
    vQuadUv    = uv;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColorCyan;
  uniform vec3 uColorPurple;
  uniform sampler2D uVideoTex;

  varying float vAlpha;
  varying float vMix;
  varying vec2 vQuadUv;
  varying vec2 vVideoUV;
  varying float vVideoBlend;

  void main() {
    // Circular billboard clip
    vec2 c = vQuadUv - 0.5;
    float d = length(c);
    if (d > 0.5) discard;

    // Soft glow: solid hot core + exponential falloff halo
    float core = smoothstep(0.5, 0.0, d);
    float glow = smoothstep(0.5, 0.12, d) * 1.65;

    // Fragment-shader video sample — safe on all GPUs (unlike vertex tex fetch).
    // Boost × 2.2 compensates for the dark video signal through additive blending.
    vec3 videoColor = texture2D(uVideoTex, vVideoUV).rgb * 2.2;

    // Neon gradient: cyan in ring phase, shifts to purple in horizon phase
    float m = clamp(vMix, 0.0, 1.0);
    vec3 neonColor = mix(uColorCyan, uColorPurple, m);

    // Cross-fade: video color → neon as vVideoBlend goes 0→1 (video→ring scroll)
    vec3 color = mix(videoColor, neonColor, vVideoBlend);

    gl_FragColor = vec4(color * glow, core * vAlpha);
  }
`;

/**
 * 50k-particle morphing portal — three-state video → ring → horizon.
 *
 * Architecture:
 *   · Geometry: PlaneGeometry(1,1) — single quad, instanced 50k times
 *   · Per-instance baked attributes:
 *       aCirclePos  — position on the glowing ring (State 1)
 *       aLinePos    — position on the undulating horizon (State 2)
 *       aVideoUV    — random UV into the video frame (State 0)
 *       aSeed       — per-particle random for stagger / size / mix
 *   · Vertex shader:
 *       - Fetches video color via vertex texture sampling (WebGL 2)
 *       - Three-state morph: posVideo → posCircle → posHorizon
 *       - Luma-driven alpha keying in video state (dark pixels vanish)
 *       - Curl noise displacement in ring/horizon states
 *       - Velocity-driven Z smear for scroll momentum
 *   · Fragment shader: video color cross-fades to cyan→purple gradient
 *   · Additive blending → premium volumetric glow
 *
 * Scroll → progress mapping (from scrollStore, driven by SmoothScroll):
 *   0.00 → 0.45  video dissolves → particles gather into ring
 *   0.45 → 1.00  ring opens → undulating horizon
 */
export function InstancedPortal() {
  const meshRef   = useRef<THREE.InstancedMesh>(null);
  const smoothVel = useRef(0);
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const videoTexRef = useRef<THREE.VideoTexture | null>(null);

  const { mesh, material } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);

    const circleArr  = new Float32Array(COUNT * 3);
    const lineArr    = new Float32Array(COUNT * 3);
    const videoUVArr = new Float32Array(COUNT * 2);
    const seedArr    = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      // State 1 — Ring: angle uniform, radius concentrated via squared jitter
      const angle       = Math.random() * Math.PI * 2;
      const radialJitter = (Math.random() ** 2 - 0.5) * 0.55;
      const r           = 2.55 + radialJitter;
      circleArr[i * 3 + 0] = Math.cos(angle) * r;
      circleArr[i * 3 + 1] = Math.sin(angle) * r;
      circleArr[i * 3 + 2] = (Math.random() - 0.5) * 0.45;

      // State 2 — Horizon: wide X, shallow Y, mild Z jitter
      const x = (Math.random() * 2 - 1) * 9;
      lineArr[i * 3 + 0] = x;
      lineArr[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
      lineArr[i * 3 + 2] = (Math.random() - 0.5) * 1.4;

      // State 0 — Video: random organic UV sampling across the frame.
      // Random distribution gives an impressionistic look — not a rigid grid —
      // so the dissolve feels like light scattering rather than a pixelated snap.
      videoUVArr[i * 2 + 0] = Math.random();
      videoUVArr[i * 2 + 1] = Math.random();

      seedArr[i] = Math.random();
    }

    geo.setAttribute("aCirclePos", new THREE.InstancedBufferAttribute(circleArr,  3));
    geo.setAttribute("aLinePos",   new THREE.InstancedBufferAttribute(lineArr,    3));
    geo.setAttribute("aVideoUV",   new THREE.InstancedBufferAttribute(videoUVArr, 2));
    geo.setAttribute("aSeed",      new THREE.InstancedBufferAttribute(seedArr,    1));

    // Dark 1×1 placeholder until the video texture is ready
    const placeholderData = new Uint8Array([8, 6, 18, 255]);
    const placeholder     = new THREE.DataTexture(placeholderData, 1, 1, THREE.RGBAFormat);
    placeholder.needsUpdate = true;

    const mat = new THREE.ShaderMaterial({
      vertexShader:   VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime:        { value: 0 },
        uProgress:    { value: 0 },
        uVelocity:    { value: 0 },
        uVideoTex:    { value: placeholder },
        uColorCyan:   { value: new THREE.Color("#00E5FF") },
        uColorPurple: { value: new THREE.Color("#8A2BE2") },
      },
      blending:    THREE.AdditiveBlending,
      transparent: true,
      depthWrite:  false,
    });

    const m = new THREE.InstancedMesh(geo, mat, COUNT);
    m.frustumCulled = false;
    // Instance matrices are unused (positions come from per-instance attributes)
    m.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    return { mesh: m, material: mat };
  }, []);

  // ── Video texture setup ────────────────────────────────────────────────────
  // A hidden DOM <video> is appended to the body so the browser decoder stays
  // alive and feeds frames to texImage2D. Off-DOM videos play but produce no
  // frames for GPU upload — this is the canonical workaround.
  useEffect(() => {
    const video = document.createElement("video");
    video.src        = "/video/argos-hero.mp4";
    video.muted      = true;
    video.loop       = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.preload    = "auto";
    video.autoplay   = true;
    // Pinned 2×2 off-screen anchor keeps the decoder hot
    video.style.cssText =
      "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(video);
    videoRef.current = video;

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace      = THREE.SRGBColorSpace;
    texture.minFilter       = THREE.LinearFilter;
    texture.magFilter       = THREE.LinearFilter;
    texture.generateMipmaps = false;
    videoTexRef.current = texture;
    material.uniforms.uVideoTex.value = texture;

    const tryPlay = () => video.play().catch(() => {});
    video.addEventListener("loadeddata", tryPlay, { once: true });
    tryPlay();

    return () => {
      video.removeEventListener("loadeddata", tryPlay);
      video.pause();
      video.removeAttribute("src");
      video.load();
      texture.dispose();
      if (video.parentNode) video.parentNode.removeChild(video);
      videoRef.current    = null;
      videoTexRef.current = null;
    };
  }, [material]);

  // ── Render loop ────────────────────────────────────────────────────────────
  useFrame((state, dt) => {
    const { scrollState, velocity } = scrollStore.getState();
    // InstancedPortal maps segment 0→1 of the global scroll state.
    const progress = Math.max(0, Math.min(1, scrollState));

    // Smooth raw velocity to dampen twitchy displacement
    const damp = Math.min(1, dt * 8);
    smoothVel.current += (velocity - smoothVel.current) * damp;

    material.uniforms.uTime.value     = state.clock.elapsedTime;
    material.uniforms.uProgress.value = progress;
    material.uniforms.uVelocity.value = smoothVel.current;

    // Upload video frame to GPU every tick — rVFC is unreliable on detached
    // elements, so `needsUpdate` is the canonical fallback
    const tex   = videoTexRef.current;
    const video = videoRef.current;
    if (tex && video && video.readyState >= 2 && video.videoWidth > 0) {
      tex.needsUpdate = true;
    }

    if (meshRef.current) {
      // Ring tilt applies only during the ring→horizon phase (p2).
      // During the video→ring phase the swarm should remain flat so the
      // video plane reads correctly without perspective distortion.
      const p2Raw = Math.max(0, Math.min((progress - 0.45) / 0.55, 1.0));
      meshRef.current.rotation.x = p2Raw * Math.PI * 0.5;
      meshRef.current.rotation.z = p2Raw * 0.08;
    }
  });

  return <primitive ref={meshRef} object={mesh} />;
}
