"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { scrollStore } from "./store";
import { _lenisScroll, _lenisLimit } from "@/ui/site/GlobalScrollSync";

// 3.6 k particles — 70 % reduction from 12 k per aesthetic audit.
// Sparse, precise, sophisticated: bright filaments against pure black void,
// not a dense fog.  Bloom radius 0.50 still fuses adjacent particles into
// continuous neon arcs at this density.
const COUNT = 3_600;

// ── Cluster centres (world space, camera at Z≈4–6, FOV 50) ───────────────────
// LA=left, Toronto=centre, Sheffield=right.  Z offset adds depth parallax.
const CLUSTER_CENTERS = [
  { x: -2.0, y: -0.2, z: -0.3 }, // LA       — lower-left
  { x:  0.0, y:  0.5, z:  0.0 }, // Toronto  — top-centre
  { x:  2.0, y: -0.1, z:  0.3 }, // Sheffield — lower-right
] as const;

// ── GLSL: Ashima simplex-3D noise (MIT) ──────────────────────────────────────
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

// ── GLSL: divergence-free curl noise ─────────────────────────────────────────
const CURL = /* glsl */ `
  vec3 curlNoise(vec3 p) {
    const float e = 0.1;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);
    float px0 = snoise(p - dx); float px1 = snoise(p + dx);
    float py0 = snoise(p - dy); float py1 = snoise(p + dy);
    float pz0 = snoise(p - dz); float pz1 = snoise(p + dz);
    float cx = (py1 - py0) - (pz1 - pz0);
    float cy = (pz1 - pz0) - (px1 - px0);
    float cz = (px1 - px0) - (py1 - py0);
    return vec3(cx, cy, cz) / (2.0 * e);
  }
`;

// ── Vertex shader ─────────────────────────────────────────────────────────────
/**
 * Four-state continuous morph driven by uScrollState (0 → 3).
 *
 *   0  Orb        — solid neon torus ring (R=2.4), purple→cyan gradient.
 *   1  Horizon    — wide undulating floor wave (X=±14, Y=-1.5→-3).
 *   2  Clusters   — 3 tight glowing node groups (LA / Toronto / Sheffield).
 *   3  Abyss      — digital rain: particles fall in looping columns.
 *
 * Blend architecture:
 *   · t01 = smoothstep over ss ∈ [0,1]  — shatter envelope peaks at 0.5
 *   · t12 = smoothstep over ss ∈ [1,2]
 *   · t23 = smoothstep over ss ∈ [2,3]
 *   · sel12 / sel23 = narrow smoothstep at integer boundaries (±0.1) to
 *     select which blend pair is active — avoids double-counting intermediate
 *     positions when cascading mix() calls.
 *
 * Verified correctness at key values:
 *   ss=0.5 → pos01 (peak shatter)
 *   ss=1.0 → posHorizon (both p01 and p12 converge)
 *   ss=1.5 → 50 % posHorizon + 50 % posCluster
 *   ss=2.0 → posCluster
 *   ss=2.5 → 50 % posCluster + 50 % posRain
 *   ss=3.0 → posRain
 */
const VERTEX_SHADER = /* glsl */ `
  ${SIMPLEX_3D}
  ${CURL}

  uniform float uTime;
  uniform float uScrollState;   // 0.0 → 3.0

  attribute float aAngle;       // ring angle [0, 2*PI], evenly distributed
  attribute vec3  aLinePos;     // baked horizon position (x wide, y low, z depth)
  attribute vec3  aClusterPos;  // baked cluster centre + local spherical jitter
  attribute vec3  aRainPos;     // x=spread, y=phase[0,8], z=depth
  attribute float aSeed;        // per-particle random in [0, 1]
  attribute float aClusterIdx;  // gravity: attractor 0/1/2; routing: route pair 0/1/2
  attribute float aRole;        // 0 = ambient, 1 = gravity-well, 2 = routing stream

  // Cluster world-space centres — must match JS CLUSTER_CENTERS constant
  const vec3 CLUSTER_LA  = vec3(-2.0, -0.2, -0.3);
  const vec3 CLUSTER_YYZ = vec3( 0.0,  0.5,  0.0);
  const vec3 CLUSTER_SHF = vec3( 2.0, -0.1,  0.3);

  varying vec3  vColor;
  varying float vAlpha;
  varying vec2  vQuadUv;

  const float PI           = 3.14159265359;
  const vec3  COLOR_PURPLE = vec3(0.541, 0.169, 0.886);
  const vec3  COLOR_CYAN   = vec3(0.0,   0.898, 1.0);
  const vec3  COLOR_RAIN   = vec3(0.0,   0.16,  0.32);  // deep ocean blue

  void main() {
    float ss = clamp(uScrollState, 0.0, 3.0);

    // ── A: Solid Neon Orb ─────────────────────────────────────────────────
    float R            = 2.4;
    float radialJitter = (aSeed - 0.5) * 0.18;
    float depthJitter  = (fract(aSeed * 9.413) - 0.5) * 0.14;
    vec3 posOrb = vec3(
      cos(aAngle) * (R + radialJitter),
      sin(aAngle) * (R + radialJitter),
      depthJitter
    );

    // Curl anchored to orb — only active during 0→1 shatter
    vec3 curlSample = curlNoise(
      posOrb * 0.55 + vec3(uTime * 0.18, aSeed * 4.7, uTime * 0.11)
    );

    // ── Ring anchor + five-phase organic lifecycle ────────────────────────
    //
    // Phase 1 — Absolute Anchor (ss 0.00 → 0.03):
    //   Particles sit at ringAnchor, alpha = 0 (fragment gate).  The smooth
    //   OGL orb is the sole visible element — no particle/orb conflict.
    //
    // Phase 2 — Organic Dissolution / Gentle Shedding (ss 0.03 → 0.12):
    //   particleFade rises 0→1 (fragment).  A slow outward radial drift
    //   (0.20 world-units maximum) lets the ring "melt" into the void.
    //   This is dissolution, NOT explosion — extremely low inertia.
    //
    // Phase 3 — Accelerating Structured Flow (ss 0.12 → 0.30):
    //   Transitions from the gentle radial melt into a low-frequency
    //   directional flow field.  The curl noise is seeded by ringBase
    //   (NOT aSeed) so particles in adjacent arc-segments share the same
    //   curl sample → synchronized "flock" motion.  globalFlowDir biases
    //   the cloud down-left toward the Data Horizon floor region.
    //   noiseScale 0.22 (large wavelength) + slow time (0.05/0.03) =
    //   wide, lazily-swirling data-stream arcs, not individual jitter.
    //
    // Phase 4 — Orb → Horizon morph (ss 0.30 → 0.75):
    //   t01 = smoothstep(0.30, 0.75, ss).  Particles travel from the flow
    //   positions into posHorizon.  shatterEnv amplitude capped at 0.50
    //   (was 1.8) — brief secondary burst without breaking cohesion.
    //
    // ringBase:    ideal ring at z=0 — curl-seed for directional coherence.
    // ringAnchor:  ringBase ± 0.02/0.01 tube jitter — each particle's rest.
    vec3 ringBase   = vec3(cos(aAngle) * R, sin(aAngle) * R, 0.0);
    vec3 ringAnchor = ringBase + vec3(
      (fract(aSeed * 7.31) - 0.5) * 0.04,   // ±0.02 radial X
      (fract(aSeed * 3.79) - 0.5) * 0.04,   // ±0.02 radial Y
      (fract(aSeed * 9.17) - 0.5) * 0.02    // ±0.01 depth   Z
    );

    // ── Low-frequency directional flow field (Task 2: structured cohesion) ─
    // Seed is keyed to ringBase (shared across adjacent arc-particles, not
    // aSeed) → nearby particles sample the same curl → synchronized flocking.
    // noiseScale 0.22 (large spatial wavelength) + very slow time (0.05 / 0.03)
    // = wide swirling arcs.  aSeed contributes a tiny constant offset (×0.25)
    // for sub-pixel individual variation without breaking inter-particle cohesion.
    vec3  flowSeed       = ringBase * 0.22 + vec3(uTime * 0.05, aSeed * 0.25, uTime * 0.03);
    vec3  structuredCurl = curlNoise(flowSeed) * 1.40;
    const vec3 globalFlowDir = vec3(-0.30, -0.80, 0.0); // down-left toward horizon floor
    vec3  flowTarget     = ringAnchor + globalFlowDir * 2.20 + structuredCurl;

    // ── Phase 2: gentle radial shedding ──────────────────────────────────
    float sheddingPhase  = smoothstep(0.03, 0.12, ss);
    vec3  radialShedding = normalize(ringAnchor) * sheddingPhase * 0.20;
    vec3  anchorWithShed = ringAnchor + radialShedding;

    // ── Phase 3: accelerating transition into structured flow ─────────────
    float transitionToFlow = smoothstep(0.12, 0.30, ss);
    vec3  posPhase123      = mix(anchorWithShed, flowTarget, transitionToFlow);

    // ── B: Data Horizon ───────────────────────────────────────────────────
    vec3 hNoisePos  = vec3(aLinePos.x * 0.4 + uTime * 0.28, aSeed * 3.9, uTime * 0.13);
    float waveY     = snoise(hNoisePos) * 0.12;
    vec3 posHorizon = vec3(aLinePos.x, aLinePos.y + waveY, aLinePos.z);

    // ── C: Node Clusters — Live Mesh (ambient · gravity · routing) ──────────
    // t12: narrow attractor window (0.40→0.72) — hold at horizon 40%, snap.
    float t12 = smoothstep(0.40, 0.72, clamp(ss - 1.0, 0.0, 1.0));

    // Resolve dominant attractor centre (gravity + routing roles use this)
    vec3 clusterCenter;
    if      (aClusterIdx > 1.5) clusterCenter = CLUSTER_SHF;
    else if (aClusterIdx > 0.5) clusterCenter = CLUSTER_YYZ;
    else                        clusterCenter = CLUSTER_LA;

    // ── Role 0: Ambient — two-octave curl drift across the full screen ─────
    // aClusterPos = world-space start position (scattered across ±3.2 X/±1.5 Y).
    // Slow large-scale curl (0.07×) gives long lazy arcs.  Fine-scale octave
    // (2.1× freq, seeded offset) adds micro-turbulence for organic feel.
    float at = uTime * 0.07;
    vec3 curlSeedA = vec3(aClusterPos.x * 0.28 + at,
                          aClusterPos.y * 0.28,
                          aClusterPos.z * 0.28 + at * 0.5);
    vec3 ambientDrift = curlNoise(curlSeedA) * 1.5
                      + curlNoise(curlSeedA * 2.1 + vec3(3.7, 1.3, 5.1)) * 0.50;
    vec3 posAmbient = aClusterPos + ambientDrift;

    // ── Role 1: Gravity well — vortex orbit + ±40% radius oscillation ─────
    // angVel ∝ 1/r → inner ring faster than outer (stellar kinematics).
    // Large-scale curl drift (amplitude 0.70) lets particles cross between
    // attractors, creating the "one live mesh" connective tissue.
    vec3  localPos  = aClusterPos - clusterCenter;
    float dist2D    = max(length(localPos.xy), 0.001);
    float initAngle = atan(localPos.y, localPos.x);
    float angVel    = 0.38 / (dist2D * 2.8 + 0.09);
    float radOsc    = 1.0 + 0.40 * sin(uTime * 0.31 + aSeed * 6.28); // ±40% breathe
    float newAngle  = initAngle + angVel * uTime;
    vec3 vortexPos  = vec3(cos(newAngle) * dist2D * radOsc,
                           sin(newAngle) * dist2D * radOsc,
                           localPos.z);
    float gt = uTime * 0.06;
    vec3 gravDrift  = curlNoise(vec3((clusterCenter.x + vortexPos.x) * 0.16 + gt,
                                     (clusterCenter.y + vortexPos.y) * 0.16,
                                      gt * 0.7)) * 0.70;
    vec3 posGravity = clusterCenter + vortexPos + gravDrift;

    // ── Role 2: Routing stream — volumetric fiber-optic tube ─────────────
    // Architecture: each particle lives INSIDE a tube following a quadratic
    // Bézier arc.  Radial scatter perpendicular to the tangent provides volume
    // (pinched at nodes, widest at apex).  The tube's centreline sways with
    // low-freq noise so every particle in the same arc-region moves TOGETHER —
    // ribbon, not static electricity.
    //
    // aClusterIdx: route 0 = LA↔YYZ · 1 = YYZ↔SHF · 2 = LA↔SHF.

    // Speed variation per particle (decorrelated from phase via different hash)
    float routeSpeed = 0.09 + fract(aSeed * 5.371) * 0.13;  // 0.09–0.22 cyc/s
    float rt         = fract(fract(aSeed * 7.193) + uTime * routeSpeed);
    float rtEnv      = sin(rt * PI);  // smooth bell: 0 at endpoints, 1 at midpoint

    // Quadratic Bézier endpoints + lifted control point (unique per route)
    vec3 rP0, rP2;
    if      (aClusterIdx > 1.5) { rP0 = CLUSTER_LA;  rP2 = CLUSTER_SHF; }
    else if (aClusterIdx > 0.5) { rP0 = CLUSTER_YYZ; rP2 = CLUSTER_SHF; }
    else                        { rP0 = CLUSTER_LA;  rP2 = CLUSTER_YYZ; }

    float liftH  = aClusterIdx > 1.5 ? 1.20 : aClusterIdx > 0.5 ? 0.80 : 0.70;
    vec3 liftDir = aClusterIdx > 1.5 ? vec3(0.0, 1.0,  0.30)
                 : aClusterIdx > 0.5 ? vec3(0.0, 1.0, -0.25)
                                     : vec3(0.0, 0.85,  0.20);
    vec3 rP1 = mix(rP0, rP2, 0.5) + normalize(liftDir) * liftH;

    // Evaluate arc position B(rt) and tangent B'(rt)
    float rc     = 1.0 - rt;
    vec3 bezPos  = rc*rc*rP0 + 2.0*rc*rt*rP1 + rt*rt*rP2;
    vec3 bezTan  = normalize(2.0*rc*(rP1 - rP0) + 2.0*rt*(rP2 - rP1));

    // Orthonormal frame perpendicular to tangent (tangents are mostly horizontal
    // so cross with world-up is safe and never degenerate)
    vec3 bRight = normalize(cross(bezTan, vec3(0.0, 1.0, 0.0)));
    vec3 bUp    = cross(bRight, bezTan);

    // Radial scatter inside the tube cross-section.
    // sqrt(uniform) gives uniform disk PDF; angle is per-particle constant.
    float scAngle = fract(aSeed * 9.731) * 6.28318;
    float scR     = sqrt(fract(aSeed * 3.917));   // [0,1), uniform disk
    float tubeR   = rtEnv * 0.12;                 // max radius (world units) at apex
    vec3  scatter = (bRight * cos(scAngle) + bUp * sin(scAngle)) * scR * tubeR;

    // Low-frequency ribbon sway — centreline moves as one fluid body.
    // Noise is keyed ONLY to rt + uTime, never to aSeed, so all particles
    // at the same arc position sway identically → smooth ribbon, not random dots.
    float sw  = rt * 1.1 + uTime * 0.07;
    vec3 sway = vec3(
      snoise(vec3(sw,         0.51, 0.73)) * 0.055,
      snoise(vec3(0.32, sw,   0.44      )) * 0.028,
      snoise(vec3(0.87, 0.23, sw        )) * 0.042
    );

    vec3 posRouting = bezPos + scatter + sway;

    // ── Role selector (branchless) ────────────────────────────────────────
    float isAmbient = step(aRole, 0.5);              // aRole == 0
    float isRouting = step(1.5, aRole);              // aRole == 2
    float isGravity = 1.0 - isAmbient - isRouting;  // aRole == 1
    vec3 posCluster = posAmbient  * isAmbient
                    + posGravity  * isGravity
                    + posRouting  * isRouting;

    // ── D: Abyss Rain ─────────────────────────────────────────────────────
    // Particles fall Y +4 → -4 then wrap.  aRainPos.y is a phase offset [0,8]
    // so each particle starts at a different height → no simultaneous wrap.
    float fallSpeed = 1.2 + aSeed * 1.0;        // 1.2 – 2.2 world-units/s
    float rainY     = 4.0 - mod(aRainPos.y + uTime * fallSpeed, 8.0);
    vec3 posRain    = vec3(aRainPos.x, rainY, aRainPos.z);

    // ── Blend weights ─────────────────────────────────────────────────────
    float t01_raw    = clamp(ss, 0.0, 1.0);

    // t01 window [0.30, 0.75]: horizon morph begins only after the structured
    // flow phase is complete at ss=0.30, giving Phases 2-3 uncontested room.
    // Particles are fully embedded in the flow field before the horizon pull
    // begins — the "Orb state" is now an extended, living data-stream phase.
    float t01        = smoothstep(0.30, 0.75, t01_raw);

    // shatterEnv: bell-curve burst that peaks at ss≈0.50 (sin of t01_raw * PI).
    // Applied to pos01 at amplitude 0.50 — a brief secondary turbulence that
    // adds texture to the horizon morph without disrupting the cohesive arcs
    // already established by the structured flow field in Phase 3.
    float shatterEnv = sin(t01_raw * PI);

    // t12 declared in State C above (hoisted for clusterDrift suppression)
    float t23 = smoothstep(0.2, 0.8, clamp(ss - 2.0, 0.0, 1.0));

    // Phase selectors: narrow window at the integer boundaries.
    // sel12 = 0 when ss < 0.9, 1 when ss > 1.1 (smooth hand-off at ss=1)
    // sel23 = 0 when ss < 1.9, 1 when ss > 2.1
    float sel12 = smoothstep(0.9, 1.1, ss);
    float sel23 = smoothstep(1.9, 2.1, ss);

    // ── Position cascade ──────────────────────────────────────────────────
    // Phase 0→1: structured flow → shatter → horizon
    //   posPhase123 carries the full 3-phase lifecycle: ring anchor → radial
    //   melt → directional flow.  By ss=0.30, particles are already in motion
    //   as a coherent data stream before the horizon morph begins.
    //   shatterEnv amplitude cut to 0.50 (was 1.8) — the structured flow field
    //   already provides organic motion; the shatter adds only a brief
    //   secondary burst mid-morph without shattering the cohesive arcs.
    vec3 pos01 = mix(posPhase123, posHorizon, t01) + curlSample * shatterEnv * 0.50;
    pos01.y    = min(pos01.y, mix(100.0, -1.2, t01));   // floor guard

    // Phase 1→2: horizon clusters into node groups
    vec3 pos12 = mix(posHorizon, posCluster, t12);

    // Phase 2→3: "The Dissolve" — clusters fragment before falling as rain.
    // frag23 leads t23 so turbulence peaks mid-transition then gives way to rain.
    float frag23   = smoothstep(0.2, 0.8, clamp(ss - 2.0, 0.0, 1.0));
    float fragAmp  = frag23 * 0.55;
    float fragFreq = 1.0 + frag23 * 2.2;
    vec3 posClusterFrag = posCluster + curlNoise(
      posCluster * fragFreq + vec3(uTime * 0.14, uTime * 0.10, uTime * 0.09)
    ) * fragAmp;
    vec3 pos23 = mix(posClusterFrag, posRain, t23);

    // Final cascade: sel12/sel23 select the active blend pair
    vec3 instancePos = mix(mix(pos01, pos12, sel12), pos23, sel23);

    // ── Color cascade ─────────────────────────────────────────────────────
    // Orb: diagonal purple→cyan + iridescent shimmer
    float diagProj = (posOrb.x - posOrb.y) / (R * 2.828);
    float colorT   = clamp(diagProj * 0.5 + 0.5, 0.0, 1.0);
    float shimmer  = sin(uTime * 1.4 + aSeed * 6.28) * 0.05;
    vec3 colorOrb  = mix(COLOR_PURPLE, COLOR_CYAN, clamp(colorT + shimmer, 0.0, 1.0));

    vec3 color01 = mix(colorOrb, COLOR_CYAN, t01);   // orb → uniform cyan
    // "The Dissolve" — ambient/gravity fade to near-black void, routing stays cyan.
    // Only the routing-stream (fiber-optic) particles keep their vivid cyan identity;
    // ambient dust and gravity wells disappear into the darkness of The Abyss.
    const vec3 COLOR_VOID    = vec3(0.01, 0.01, 0.05);
    vec3 colorDissolveA = mix(COLOR_CYAN, COLOR_VOID, smoothstep(0.0, 0.75, t23));
    vec3 colorDissolveG = mix(COLOR_CYAN, COLOR_VOID, smoothstep(0.1, 0.90, t23));
    vec3 colorDissolveR = COLOR_CYAN;  // routing stays vivid — these become rain streaks
    vec3 colorDissolved = colorDissolveA * isAmbient
                        + colorDissolveG * isGravity
                        + colorDissolveR * isRouting;
    vec3 color23 = mix(colorDissolved, COLOR_RAIN, smoothstep(0.8, 1.0, t23));
    vColor = mix(mix(color01, COLOR_CYAN, sel12), color23, sel23);

    // ── Alpha cascade ─────────────────────────────────────────────────────
    float alpha01 = mix(0.85 + 0.15 * aSeed, 0.06 + 0.16 * aSeed, t01);
    // Role-dependent node alpha.
    // Routing: smooth bell-curve fade (rtEnv) × slow per-particle lifetime pulse.
    // NO fast abs(sin()) flicker — that was causing the jagged dotted-line look
    // by making adjacent particles blink in and out of phase with each other.
    float pktPulse  = 0.70 + 0.30 * sin(uTime * 0.35 + aSeed * 13.7); // ~18s period
    float nodeAlpha = aRole > 1.5 ? (0.30 + 0.15 * fract(aSeed * 3.7)) * rtEnv * pktPulse
                    : aRole > 0.5 ? 0.18 + 0.10 * aSeed   // gravity: vortex filament
                                  : 0.05 + 0.05 * aSeed;  // ambient: fine dust
    float alpha12 = mix(0.06 + 0.16 * aSeed, nodeAlpha, t12);
    // Role-dependent abyss alpha:
    //   ambient → near-invisible (0.005–0.010) — dust absorbed by darkness
    //   gravity → dim remnant (0.02–0.06)      — faint filaments remain
    //   routing → stays bright (0.12–0.20)     — data pulses survive the void
    float abyssAlphaAmbient = 0.005 + 0.005 * aSeed;
    float abyssAlphaGravity = 0.02  + 0.04  * aSeed;
    float abyssAlphaRouting = 0.12  + 0.08  * aSeed;
    float abyssAlpha = abyssAlphaAmbient * isAmbient
                     + abyssAlphaGravity * isGravity
                     + abyssAlphaRouting * isRouting;
    float alpha23 = mix(nodeAlpha, abyssAlpha, t23);
    vAlpha = mix(mix(alpha01, alpha12, sel12), alpha23, sel23);

    // ── Billboard quad ────────────────────────────────────────────────────
    float baseSize   = 0.022 + aSeed * 0.016;
    float sizeMult01 = mix(1.35, 0.28, t01);         // orb large → horizon tiny
    // Routing streams are slightly larger (visible data packets);
    // gravity/ambient are sub-pixel fine dust (~1–1.5 px screen-space).
    // Routing dot size is smaller now — the volumetric spread comes from
    // radial scatter, not from large individual sprites.  Still bell-modulated
    // so dots shrink to near-invisible as they arrive at a city node.
    float clusterMult = aRole > 1.5 ? 0.20 * (0.5 + 0.5 * rtEnv) : 0.11;
    float sizeMult12 = mix(0.28, clusterMult, t12);
    float sizeMult23 = mix(clusterMult, 0.12, t23);  // cluster dust → rain very small
    float sizeMult   = mix(mix(sizeMult01, sizeMult12, sel12), sizeMult23, sel23);
    float sizeAdd    = shatterEnv * 0.14;          // brief puff during shatter
    float size       = baseSize * (sizeMult + sizeAdd);

    vec4 mvPos = modelViewMatrix * vec4(instancePos, 1.0);
    mvPos.xy  += position.xy * size;
    gl_Position = projectionMatrix * mvPos;

    vQuadUv = uv;
  }
`;

// ── Fragment shader ───────────────────────────────────────────────────────────
const FRAGMENT_SHADER = /* glsl */ `
  // Bell-curve dimming driven from JS: dips to ~0.55 at the Horizon→Nodes
  // midpoint (ss ≈ 1.5) and returns to 1.0 outside ss ∈ [1, 2].
  uniform float uTransitionDimming;

  // Scroll state 0→3, mirrored here from the vertex shader so the fragment
  // stage can gate particle visibility.  smoothstep() returns 0 below edge0
  // and 1 above edge1, so no explicit clamp is needed.
  uniform float uScrollState;

  varying vec3  vColor;
  varying float vAlpha;
  varying vec2  vQuadUv;

  void main() {
    vec2  c = vQuadUv - 0.5;
    float d = length(c);
    if (d > 0.5) discard;

    float core  = smoothstep(0.5, 0.0, d);
    float halo  = exp(-d * 5.0) * 1.75;
    float shape = core + halo * 0.35;

    // ── Hero fade-in gate ─────────────────────────────────────────────────
    // Aligned with Phase 2 (Organic Dissolution, ss 0.03 → 0.12).
    // Phase 1 (ss < 0.03): complete transparency — OGL orb owns the hero.
    // Phase 2 (ss 0.03→0.12): particles fade in AS the ring melts — never
    // popping into visibility, always co-arriving with the radial drift.
    // At ss = 0.12 (Phase 3 onset) particleFade = 1.0: particles are fully
    // opaque exactly when the structured flow field takes over.
    float particleFade = smoothstep(0.03, 0.12, uScrollState);

    gl_FragColor = vec4(vColor * shape, shape * vAlpha * uTransitionDimming * particleFade);
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────
/**
 * OrbToWaveParticles — 12 k InstancedMesh billboard particles.
 *
 * Continuous four-state morph across the full page (uScrollState 0 → 3):
 *
 *   0.0  Solid neon ring — bloom-welded tube, purple→cyan diagonal gradient.
 *   0.5  Peak shatter   — curl noise at max amplitude, violent yet elegant.
 *   1.0  Data Horizon   — sparse floor wave, fine luminous dust.
 *   2.0  Node Clusters  — 3 glowing spheres: LA / Toronto / Sheffield.
 *   3.0  Abyss          — parallel rain columns falling into darkness.
 *
 * Architecture:
 *   · PlaneGeometry(1,1) billboard × COUNT — no per-frame CPU uploads
 *   · Per-instance: aAngle, aLinePos, aClusterPos, aRainPos, aSeed (all baked)
 *   · Zero subscriptions — useFrame polls scrollStore.getState()
 *   · Zero textures — pure GLSL math (runs on integrated GPUs)
 *   · AdditiveBlending + depthWrite:false → correct glow compositing
 */
export function OrbToWaveParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { mesh, material } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);

    // ── Per-instance buffers ───────────────────────────────────────────────
    const angleArr      = new Float32Array(COUNT);
    const linePosArr    = new Float32Array(COUNT * 3);
    const clusterPosArr = new Float32Array(COUNT * 3);
    const clusterIdxArr = new Float32Array(COUNT);       // 0=LA, 1=YYZ, 2=SHF
    const roleArr       = new Float32Array(COUNT);       // 0=ambient 1=gravity 2=routing
    const rainPosArr    = new Float32Array(COUNT * 3);
    const seedArr       = new Float32Array(COUNT);

    // Role allocation: 40% ambient · 45% gravity-well · ~15% routing stream
    // Routing proportion increased vs. the previous 5% so data-stream fibers
    // remain clearly visible after the 70% overall density reduction.
    const COUNT_AMBIENT = Math.floor(COUNT * 0.40);  // 1440 — fine ambient dust
    const COUNT_GRAVITY = Math.floor(COUNT * 0.45);  // 1620 — vortex filaments
    // Routing fills the remainder (~540 particles, 180 per route)
    const COUNT_ROUTING = COUNT - COUNT_AMBIENT - COUNT_GRAVITY;
    const perGravity    = Math.ceil(COUNT_GRAVITY / 3);
    const perRouting    = Math.ceil(COUNT_ROUTING / 3);

    for (let i = 0; i < COUNT; i++) {
      // ── Ring angle (evenly spaced + tiny jitter) ─────────────────────
      angleArr[i] = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.004;

      // ── Horizon floor strip ──────────────────────────────────────────
      linePosArr[i * 3 + 0] = (Math.random() * 2 - 1) * 14.0;   // X ±14
      linePosArr[i * 3 + 1] = -1.5 - Math.random() * 1.5;        // Y -1.5→-3.0
      linePosArr[i * 3 + 2] = (Math.random() - 0.5) * 8.0;       // Z ±4

      // ── Role-based cluster / world position ─────────────────────────────
      if (i < COUNT_AMBIENT) {
        // Role 0: Ambient — world-space drift origin scattered across full screen.
        // Curl noise in GLSL advects these from their start positions; no cluster.
        roleArr[i]       = 0;
        clusterIdxArr[i] = Math.floor(Math.random() * 3); // weak association only
        clusterPosArr[i * 3 + 0] = (Math.random() * 2 - 1) * 3.2;  // X ±3.2
        clusterPosArr[i * 3 + 1] = (Math.random() * 2 - 1) * 1.5;  // Y ±1.5
        clusterPosArr[i * 3 + 2] = (Math.random() * 2 - 1) * 0.5;  // Z ±0.5
      } else if (i < COUNT_AMBIENT + COUNT_GRAVITY) {
        // Role 1: Gravity-well — hollow disc orbit baked around attractor cluster.
        // maxR=0.55 wider than before; combined with 0.70 curl drift → cross-cluster flow.
        roleArr[i]       = 1;
        const gIdx = Math.min(Math.floor((i - COUNT_AMBIENT) / perGravity), 2);
        const c    = CLUSTER_CENTERS[gIdx];
        clusterIdxArr[i] = gIdx;
        const angle = Math.random() * Math.PI * 2;
        const minR  = 0.08;
        const maxR  = 0.55;  // wider band, curl drift bridges inter-cluster gaps
        const r     = minR + (maxR - minR) * Math.sqrt(Math.random()); // skew to outer
        clusterPosArr[i * 3 + 0] = c.x + Math.cos(angle) * r;
        clusterPosArr[i * 3 + 1] = c.y + Math.sin(angle) * r * 0.55; // Y-flatten → oval
        clusterPosArr[i * 3 + 2] = c.z + (Math.random() * 2 - 1) * 0.08;
      } else {
        // Role 2: Routing stream — Bézier arc between city pairs.
        // aClusterIdx encodes route: 0=LA↔YYZ, 1=YYZ↔SHF, 2=LA↔SHF.
        // aSeed (set below) acts as the per-particle phase offset [0,1].
        roleArr[i]       = 2;
        const rIdx = Math.min(
          Math.floor((i - COUNT_AMBIENT - COUNT_GRAVITY) / perRouting), 2
        );
        clusterIdxArr[i]     = rIdx;
        clusterPosArr[i * 3] = 0; // unused for routing (GLSL derives pos from Bézier)
        clusterPosArr[i * 3 + 1] = 0;
        clusterPosArr[i * 3 + 2] = 0;
      }

      // ── Rain / Abyss position ────────────────────────────────────────
      rainPosArr[i * 3 + 0] = (Math.random() * 2 - 1) * 8.0;   // X ±8
      rainPosArr[i * 3 + 1] = Math.random() * 8.0;              // phase [0, 8]
      rainPosArr[i * 3 + 2] = (Math.random() - 0.5) * 5.0;     // Z ±2.5

      seedArr[i] = Math.random();
    }

    geo.setAttribute("aAngle",      new THREE.InstancedBufferAttribute(angleArr,      1));
    geo.setAttribute("aLinePos",    new THREE.InstancedBufferAttribute(linePosArr,    3));
    geo.setAttribute("aClusterPos", new THREE.InstancedBufferAttribute(clusterPosArr, 3));
    geo.setAttribute("aClusterIdx", new THREE.InstancedBufferAttribute(clusterIdxArr, 1));
    geo.setAttribute("aRole",       new THREE.InstancedBufferAttribute(roleArr,       1));
    geo.setAttribute("aRainPos",    new THREE.InstancedBufferAttribute(rainPosArr,    3));
    geo.setAttribute("aSeed",       new THREE.InstancedBufferAttribute(seedArr,       1));

    const mat = new THREE.ShaderMaterial({
      vertexShader:   VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime:              { value: 0   },
        uScrollState:       { value: 0   },
        uTransitionDimming: { value: 1.0 },
      },
      blending:    THREE.AdditiveBlending,
      transparent: true,
      depthWrite:  false,
    });

    const m = new THREE.InstancedMesh(geo, mat, COUNT);
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    return { mesh: m, material: mat };
  }, []);

  // Scaled time accumulator — runs at 50 % speed on /pricing so ambient
  // particle motion feels calm rather than energetic.
  const scaledTimeRef = useRef(0);

  useFrame((_, dt) => {
    const { isPricing } = scrollStore.getState();

    scaledTimeRef.current += dt * (isPricing ? 0.5 : 1.0);

    // ── Direct scroll → shader pipeline ────────────────────────────────────
    // Read window.scrollY on EVERY frame, bypassing the GlobalScrollSync
    // boundary-cache entirely.  This makes morphing live from frame 1 with
    // zero dependency on preloader timing, GSAP ScrollTrigger lifecycle, or
    // Zustand store hydration.
    //
    // Full-page normalised progress p ∈ [0, 1] maps to uScrollState ∈ [0, 3]:
    //
    //   p 0.00 → 0.33   ss 0 → 1   Orb      → DataHorizon   (first third)
    //   p 0.33 → 0.67   ss 1 → 2   Horizon  → NodeClusters  (middle third)
    //   p 0.67 → 1.00   ss 2 → 3   Nodes    → Abyss         (final third)
    //
    // The GSAP Nodes pin-spacer (100 vh) is a real DOM element, so it is
    // already included in scrollHeight — the Nodes zone therefore
    // automatically receives proportionally more scroll depth. ✓
    let targetSS: number;
    if (isPricing) {
      // Ambient routes: pin at NodeClusters, slow time
      targetSS = 2.0;
    } else {
      // Use Lenis's own position — immune to scroll-behavior:smooth lag.
      // Fall back to DOM measurement until the first scroll event populates
      // _lenisLimit (initial sentinel value is 1).
      const maxScroll = Math.max(
        _lenisLimit,
        document.documentElement.scrollHeight - window.innerHeight,
        1,
      );
      targetSS = Math.min(3.0, (_lenisScroll / maxScroll) * 3.0);
    }

    // Lerp smoothing — factor 0.05 ≈ 250 ms exponential lag at 60 fps.
    // Replaces the scrub:1.5 that GSAP ScrollTrigger used to provide.
    // Also handles the /pricing → / restoration morph: when isPricing flips
    // false the lerp naturally eases the shader from 2.0 → 0 as scrollY=0,
    // producing the same fluid "reform" that RouteSync's GSAP tween intended.
    const ss = THREE.MathUtils.lerp(
      material.uniforms.uScrollState.value,
      targetSS,
      0.05,
    );

    material.uniforms.uTime.value        = scaledTimeRef.current;
    material.uniforms.uScrollState.value = ss;

    // Horizon→Nodes dimming: 45 % bell-curve dip centred at ss=1.5.
    // raw12 = 0 outside ss ∈ [1,2] → sin(0)=0 → dimming=1.0 (no effect).
    const raw12 = Math.max(0, Math.min(1, ss - 1.0));
    material.uniforms.uTransitionDimming.value = 1.0 - 0.45 * Math.sin(raw12 * Math.PI);
  });

  return <primitive ref={meshRef} object={mesh} />;
}
