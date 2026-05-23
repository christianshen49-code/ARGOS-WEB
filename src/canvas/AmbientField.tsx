"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const N = 1500;

const VS = /* glsl */ `
  attribute float aSeed;
  attribute float aBaseSize;
  uniform float uTime;
  varying float vGlow;

  void main() {
    // Per-point drift — each axis uses a different frequency and is keyed
    // off the per-particle seed so no two move alike.
    vec3 drift = vec3(
      sin(uTime * 0.32 + aSeed * 6.28318),
      cos(uTime * 0.28 + aSeed * 4.99),
      sin(uTime * 0.22 + aSeed * 7.11)
    ) * 0.20;

    vec3 pos = position + drift;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);

    // Brightness pulse with phase from seed
    float pulse = 0.55 + 0.45 * sin(uTime * 1.3 + aSeed * 6.28318);
    vGlow = pulse;

    gl_PointSize = aBaseSize * 65.0 / -mv.z * pulse;
    gl_Position = projectionMatrix * mv;
  }
`;

const FS = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vGlow;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    float core = smoothstep(1.0, 0.0, d);
    float halo = smoothstep(1.0, 0.45, d) * 0.45;
    vec3 col = mix(uColorA, uColorB, vGlow);
    gl_FragColor = vec4(col, (core + halo) * vGlow * 0.65);
  }
`;

/**
 * 3D ambient particle volume — 1500 points distributed around the hero
 * scene origin (z in [-2.5, 2]). The shader does all the work:
 *
 *   • per-particle drift with seed-shifted phases gives every point its
 *     own subtle motion
 *   • per-particle pulse fades brightness in/out asynchronously
 *   • size attenuates with view-space depth so the volume reads as a
 *     genuine 3D field when the camera parallaxes
 *
 * Rendered additively with `depthTest: false` so the cloud always reads,
 * regardless of whether the hero plane or globe occludes it geometrically.
 * This is what carries the "real 3D perspective" feel during hero phase —
 * particles in front of and behind the hero plane shift differently as the
 * camera moves.
 */
export function AmbientField() {
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(N * 3);
    const seeds = new Float32Array(N);
    const sizes = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      // Slight horizontal bias for cinematic frame
      positions[i * 3] = (Math.random() - 0.5) * 8.4;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 5.0;
      positions[i * 3 + 2] = -2.5 + Math.random() * 4.5;
      seeds[i] = Math.random();
      sizes[i] = 0.4 + Math.pow(Math.random(), 3) * 1.8;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    g.setAttribute("aBaseSize", new THREE.BufferAttribute(sizes, 1));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColorA: { value: new THREE.Color("#16f0c8") },
          uColorB: { value: new THREE.Color("#4fa8ff") },
        },
        vertexShader: VS,
        fragmentShader: FS,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useFrame((_, dt) => {
    material.uniforms.uTime.value += Math.min(dt, 0.05);
  });

  return (
    <points ref={ref} geometry={geometry} material={material} renderOrder={5} />
  );
}
