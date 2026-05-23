"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const N = 1200;
const R_INNER = 18;
const R_OUTER = 28;

const CYAN = new THREE.Color("#16f0c8");
const ACCENT = new THREE.Color("#4fa8ff");

/**
 * 2000-particle starfield shell behind the globe. Each star has a random
 * radius (R_INNER..R_OUTER), a colour drawn predominantly from cyan with a
 * sparse accent population, and a per-vertex size sampled from a long-tail
 * distribution so a few stars appear noticeably brighter.
 *
 * Rendered with a tiny custom shader: a vertex shader that scales size with
 * camera distance, and a fragment shader that softens the point into a glow
 * disk. Additive blending, no depth write.
 *
 * Counter-rotates slowly relative to the globe for a parallax sense of
 * depth.
 */
export function Starfield() {
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const r = R_INNER + Math.random() * (R_OUTER - R_INNER);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      c.copy(Math.random() < 0.85 ? CYAN : ACCENT);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      // Long-tail size distribution — most stars dim pinpricks, a few brighter
      sizes[i] = 0.3 + Math.pow(Math.random(), 6) * 2.2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float aSize;
          attribute vec3 aColor;
          uniform float uTime;
          varying vec3 vColor;
          varying float vTwinkle;
          void main() {
            vColor = aColor;
            // Per-star twinkle phase based on position hash
            float seed = position.x * 12.9898 + position.y * 78.233 + position.z * 37.719;
            float ph = fract(sin(seed) * 43758.5453);
            vTwinkle = 0.7 + 0.3 * sin(uTime * 1.4 + ph * 6.2831);

            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            // Pixel size — small stars stay small even up close; never block content
            gl_PointSize = aSize * 90.0 / -mv.z * vTwinkle;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vColor;
          varying float vTwinkle;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c) * 2.0;
            float core = smoothstep(1.0, 0.0, d);
            float glow = smoothstep(1.0, 0.4, d) * 0.45;
            gl_FragColor = vec4(vColor, (core + glow) * vTwinkle);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;
    if (ref.current) {
      // Counter-drift for parallax against the globe
      ref.current.rotation.y -= delta * 0.012;
      ref.current.rotation.x += delta * 0.004;
    }
  });

  return <points ref={ref} geometry={geometry} material={material} />;
}
