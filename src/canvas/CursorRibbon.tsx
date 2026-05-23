"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useArgosStore } from "@/store/useArgosStore";

const CTRL = 24;        // control points retained in the ring buffer
const SAMPLES = 96;     // dense Catmull-Rom samples along the curve
const BASE_WIDTH = 0.04; // world units at the head — narrowed for finer trail

const CYAN = new THREE.Color("#16f0c8");
const ACCENT = new THREE.Color("#4fa8ff");

/**
 * Smooth ribbon trail that follows the cursor.
 *
 * Pipeline each frame:
 *   1. Push the latest cursor position (NDC → world at z = 0) into a ring
 *      buffer of {@link CTRL} control points.
 *   2. Build a `CatmullRomCurve3` through the buffer and sample
 *      {@link SAMPLES} points along it for a silky polyline.
 *   3. For each sample compute a screen-space perpendicular via the
 *      tangent of the curve, then write two vertices (left / right of the
 *      curve) offset by a width that tapers quadratically from head to
 *      tail.
 *   4. Two-vertex strip → indexed triangles → uploaded to the buffer
 *      geometry.
 *
 * The custom shader fades alpha with the per-vertex `aProgress` attribute
 * (0 at head, 1 at tail) and mixes the cyan / accent palette across the
 * same axis. Additive blending, no depth write, depth test disabled, high
 * `renderOrder` — always wins over the scene.
 */
export function CursorRibbon() {
  const { viewport } = useThree();
  const headIdx = useRef(0);
  const filledRef = useRef(0); // how many control points have been written
  const ctrlBuf = useMemo(
    () => Array.from({ length: CTRL }, () => new THREE.Vector3()),
    [],
  );

  // Geometry — 2 vertices per sample, indexed triangle strip.
  const { geometry, positionAttr } = useMemo(() => {
    const positions = new Float32Array(SAMPLES * 2 * 3);
    const progress = new Float32Array(SAMPLES * 2);
    for (let i = 0; i < SAMPLES; i++) {
      const t = i / (SAMPLES - 1); // 0 at head, 1 at tail
      progress[i * 2] = t;
      progress[i * 2 + 1] = t;
    }
    const indices: number[] = [];
    for (let i = 0; i < SAMPLES - 1; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, c, b, d, c);
    }
    const geometry = new THREE.BufferGeometry();
    const positionAttr = new THREE.BufferAttribute(positions, 3);
    positionAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", positionAttr);
    geometry.setAttribute("aProgress", new THREE.BufferAttribute(progress, 1));
    geometry.setIndex(indices);
    geometry.setDrawRange(0, 0); // hidden until enough control points exist
    return { geometry, positionAttr };
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColorHead: { value: CYAN.clone() },
          uColorTail: { value: ACCENT.clone() },
        },
        vertexShader: /* glsl */ `
          attribute float aProgress;
          varying float vProgress;
          void main() {
            vProgress = aProgress;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColorHead;
          uniform vec3 uColorTail;
          varying float vProgress;
          void main() {
            float alpha = pow(1.0 - vProgress, 1.7) * 0.95;
            vec3 col = mix(uColorHead, uColorTail, vProgress);
            // slight inner-glow boost at the very head
            col += vec3(1.0) * pow(1.0 - vProgress, 8.0) * 0.6;
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Scratch vectors so we don't allocate every frame.
  const scratchA = useMemo(() => new THREE.Vector3(), []);
  const scratchB = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const { cursor } = useArgosStore.getState();
    const wx = (cursor.x * viewport.width) / 2;
    const wy = (cursor.y * viewport.height) / 2;

    // Push at head; head is the LATEST point.
    ctrlBuf[headIdx.current].set(wx, wy, 0.1);
    headIdx.current = (headIdx.current + 1) % CTRL;
    filledRef.current = Math.min(filledRef.current + 1, CTRL);

    if (filledRef.current < 4) return; // need ≥ 4 for catmull-rom

    // Assemble ordered points: from newest (head-1) backwards to oldest.
    const ordered: THREE.Vector3[] = [];
    for (let i = 0; i < filledRef.current; i++) {
      const idx = (headIdx.current - 1 - i + CTRL) % CTRL;
      ordered.push(ctrlBuf[idx]);
    }

    const curve = new THREE.CatmullRomCurve3(ordered, false, "catmullrom", 0.5);
    const samples = curve.getPoints(SAMPLES - 1);

    const pos = positionAttr.array as Float32Array;
    for (let i = 0; i < SAMPLES; i++) {
      const p = samples[i];
      const prev = samples[Math.max(0, i - 1)];
      const next = samples[Math.min(SAMPLES - 1, i + 1)];
      // Tangent in screen plane
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      const len = Math.hypot(tx, ty) || 1e-5;
      // Perpendicular (90° rotation in XY)
      const nx = -ty / len;
      const ny = tx / len;

      // Width tapers quadratically from head to tail
      const t = i / (SAMPLES - 1);
      const w = (1 - t) * (1 - t) * BASE_WIDTH;

      scratchA.set(p.x + nx * w, p.y + ny * w, 0.1);
      scratchB.set(p.x - nx * w, p.y - ny * w, 0.1);

      const k = i * 6;
      pos[k] = scratchA.x;
      pos[k + 1] = scratchA.y;
      pos[k + 2] = scratchA.z;
      pos[k + 3] = scratchB.x;
      pos[k + 4] = scratchB.y;
      pos[k + 5] = scratchB.z;
    }
    positionAttr.needsUpdate = true;
    geometry.setDrawRange(0, (SAMPLES - 1) * 6);
  });

  return <mesh geometry={geometry} material={material} renderOrder={999} />;
}
