"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useArgosStore } from "@/store/useArgosStore";
import { choreo } from "@/canvas/choreography";

const RADIUS = 1.45;

const CITIES = [
  { name: "LOS ANGELES", lat: 34.0522, lon: -118.2437 },
  { name: "TORONTO", lat: 43.6532, lon: -79.3832 },
  { name: "SHEFFIELD", lat: 53.3811, lon: -1.4701 },
] as const;

const CYAN = new THREE.Color("#16f0c8");
const ACCENT = new THREE.Color("#4fa8ff");

function latLonToVec3(lat: number, lon: number, r: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

// ── shaders ────────────────────────────────────────────────────────────────

const ATMOSPHERE_VS = /* glsl */ `
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const ATMOSPHERE_FS = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    float fres = pow(1.0 - max(dot(vN, vView), 0.0), 2.5);
    gl_FragColor = vec4(uColor, fres * uIntensity);
  }
`;

const LATTICE_VS = /* glsl */ `
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    vWorld = position;
    gl_Position = projectionMatrix * mv;
  }
`;

const LATTICE_FS = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vWorld;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  void main() {
    // Facing-the-camera term so back-side lines fade
    float ndv = max(dot(vN, vView), 0.0);
    float facing = smoothstep(0.0, 0.45, ndv);

    // Slow wave that crawls across the lattice
    float wave = 0.5 + 0.5 * sin(uTime * 0.6 + vWorld.y * 2.0 + vWorld.x * 1.4);
    float pulse = mix(0.4, 1.0, wave);

    // Sparse hotspots — a few edges that glow brighter
    float h = hash(floor(vWorld * 4.0));
    float hot = smoothstep(0.92, 1.0, h);

    float a = facing * pulse * 0.55 + hot * 0.8 * facing;
    gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
  }
`;

const ARC_VS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ARC_FS = /* glsl */ `
  uniform float uTime;
  uniform float uDrawn;
  uniform vec3 uColA;
  uniform vec3 uColB;
  varying vec2 vUv;

  void main() {
    float u = vUv.x;
    if (u > uDrawn) discard;

    // Flowing dash — slowed so it reads as data flow, not strobing
    float dash = fract(u * 6.0 - uTime * 0.30);
    float head = pow(dash, 5.0);

    vec3 col = mix(uColA, uColB, u);
    col += vec3(1.0) * head * 0.7;

    // Soft falloff near the very tip of the drawn portion
    float tip = 1.0 - smoothstep(uDrawn - 0.04, uDrawn, u);

    // Round the tube by darkening rim — vUv.y is around the tube (0..1)
    float rim = 1.0 - abs(vUv.y - 0.5) * 2.0;
    rim = smoothstep(0.0, 0.5, rim);

    float alpha = (0.55 + head * 0.45) * tip * rim;
    gl_FragColor = vec4(col, alpha);
  }
`;

const PING_VS = /* glsl */ `
  uniform float uSize;
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5; // local [-1,1] → [0,1]
    // Billboard: rebuild the quad in view space at the group origin
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * uSize;
    gl_Position = projectionMatrix * mv;
  }
`;

const PING_FS = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    // Two overlapping ping rings, offset by 0.5 in phase, expanding + fading
    float t1 = fract(uTime * 0.55 + uPhase);
    float t2 = fract(uTime * 0.55 + uPhase + 0.5);
    float r = length(vUv - 0.5) * 2.0;
    float ring1 = smoothstep(t1 - 0.06, t1, r) - smoothstep(t1, t1 + 0.06, r);
    float ring2 = smoothstep(t2 - 0.06, t2, r) - smoothstep(t2, t2 + 0.06, r);
    float fade = (1.0 - t1) * ring1 + (1.0 - t2) * ring2;
    gl_FragColor = vec4(uColor, fade * 0.6);
  }
`;

// ── city pin component ─────────────────────────────────────────────────────

function CityPin({
  position,
  phase,
  visible,
}: {
  position: THREE.Vector3;
  phase: number;
  visible: number; // 0..1
}) {
  const coreRef = useRef<THREE.Mesh>(null);
  const pingMatRef = useRef<THREE.ShaderMaterial>(null);

  const pingMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPhase: { value: phase },
          uColor: { value: CYAN.clone() },
          uSize: { value: 0.55 },
        },
        vertexShader: PING_VS,
        fragmentShader: PING_FS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [phase],
  );

  // Outward normal at this city's position, used to orient the upward beam
  const outward = useMemo(() => position.clone().normalize(), [position]);
  const beamQuat = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
    return q;
  }, [outward]);
  // Beam length + position along the outward axis (sits on the surface)
  const beamLen = 0.32;
  const beamPos = useMemo(
    () => outward.clone().multiplyScalar(RADIUS + beamLen / 2),
    [outward, beamLen],
  );

  useFrame((_, delta) => {
    pingMat.uniforms.uTime.value += delta;
    if (coreRef.current) {
      const t = pingMat.uniforms.uTime.value;
      const pulse = 0.85 + 0.15 * Math.sin(t * 2.2 + phase * 4.0);
      coreRef.current.scale.setScalar(visible * pulse);
    }
    if (pingMatRef.current) {
      (pingMatRef.current.uniforms.uColor.value as THREE.Color).copy(CYAN);
    }
  });

  return (
    <group position={position}>
      {/* Core sphere */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.038, 16, 16]} />
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0.95 * visible}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Billboarded radar ping ring — quad at local (0,0,0), shader rebuilds it in view space */}
      <mesh material={pingMat} renderOrder={2}>
        <planeGeometry args={[2, 2]} />
      </mesh>

      {/* Upward light beam — oriented along the outward normal at this city */}
      <mesh position={beamPos} quaternion={beamQuat}>
        <cylinderGeometry args={[0.008, 0.025, beamLen, 12, 1, true]} />
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0.6 * visible}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ── main scene ─────────────────────────────────────────────────────────────

export function NodesGlobe() {
  const rotRef = useRef<THREE.Group>(null);

  const cityPositions = useMemo(
    () => CITIES.map((c) => latLonToVec3(c.lat, c.lon, RADIUS)),
    [],
  );

  // Lattice shader material — animated wireframe
  const latticeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: CYAN.clone() },
        },
        vertexShader: LATTICE_VS,
        fragmentShader: LATTICE_FS,
        wireframe: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  // Atmosphere shader material — outer halo via backside Fresnel
  const atmoMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: CYAN.clone() },
          uIntensity: { value: 0.85 },
        },
        vertexShader: ATMOSPHERE_VS,
        fragmentShader: ATMOSPHERE_FS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      }),
    [],
  );

  // ── arc tube geometry: one TubeGeometry per pair, merged ───────────────
  const { arcGeom, arcMat } = useMemo(() => {
    // Build per-pair tubes with their own merged geometry. We embed the
    // shared `uv.x` (curve progress 0..1) directly from TubeGeometry which
    // already provides that. We splice three tube geometries into one
    // BufferGeometry by re-using a single material.
    const tubeRadius = 0.014;
    const tubularSegments = 96;
    const radialSegments = 8;

    const geometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < cityPositions.length; i++) {
      for (let j = i + 1; j < cityPositions.length; j++) {
        const a = cityPositions[i];
        const b = cityPositions[j];
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const lift = mid
          .clone()
          .normalize()
          .multiplyScalar(RADIUS + a.distanceTo(b) * 0.55);
        const curve = new THREE.QuadraticBezierCurve3(a, lift, b);
        const tube = new THREE.TubeGeometry(
          curve,
          tubularSegments,
          tubeRadius,
          radialSegments,
          false,
        );
        geometries.push(tube);
      }
    }

    // Merge by manually concatenating attributes — we don't depend on
    // BufferGeometryUtils so this stays self-contained.
    let totalPos = 0;
    let totalUv = 0;
    let totalIdx = 0;
    geometries.forEach((g) => {
      totalPos += (g.getAttribute("position") as THREE.BufferAttribute).count * 3;
      totalUv += (g.getAttribute("uv") as THREE.BufferAttribute).count * 2;
      totalIdx += g.getIndex()?.count ?? 0;
    });

    const positions = new Float32Array(totalPos);
    const uvs = new Float32Array(totalUv);
    const indices = new Uint32Array(totalIdx);

    let posOff = 0;
    let uvOff = 0;
    let idxOff = 0;
    let vertOff = 0;
    geometries.forEach((g) => {
      const p = g.getAttribute("position") as THREE.BufferAttribute;
      const u = g.getAttribute("uv") as THREE.BufferAttribute;
      const ix = g.getIndex();
      positions.set(p.array as Float32Array, posOff);
      uvs.set(u.array as Float32Array, uvOff);
      if (ix) {
        for (let k = 0; k < ix.count; k++) {
          indices[idxOff + k] = (ix.array[k] as number) + vertOff;
        }
        idxOff += ix.count;
      }
      vertOff += p.count;
      posOff += p.count * 3;
      uvOff += u.count * 2;
      g.dispose();
    });

    const arcGeom = new THREE.BufferGeometry();
    arcGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    arcGeom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    arcGeom.setIndex(new THREE.BufferAttribute(indices, 1));

    const arcMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDrawn: { value: 0 },
        uColA: { value: CYAN.clone() },
        uColB: { value: ACCENT.clone() },
      },
      vertexShader: ARC_VS,
      fragmentShader: ARC_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    return { arcGeom, arcMat };
  }, [cityPositions]);

  useFrame((_, delta) => {
    const t = performance.now() * 0.001;

    if (rotRef.current) {
      const { cursor } = useArgosStore.getState();
      rotRef.current.rotation.y += delta * 0.14;
      rotRef.current.rotation.x +=
        (cursor.y * 0.22 - rotRef.current.rotation.x) * 0.04;
    }

    latticeMat.uniforms.uTime.value = t;
    arcMat.uniforms.uTime.value = t;
    arcMat.uniforms.uDrawn.value = choreo.arcDrawn;

    // Cursor proximity to screen centre → atmosphere brightness boost
    const { cursor } = useArgosStore.getState();
    const distC = Math.hypot(cursor.x, cursor.y);
    const proximity = Math.exp(-distC * 1.6);
    atmoMat.uniforms.uIntensity.value = 0.7 + proximity * 0.55;
  });

  return (
    <group ref={rotRef}>
      {/* Outer atmospheric halo */}
      <mesh material={atmoMat}>
        <sphereGeometry args={[RADIUS * 1.16, 64, 64]} />
      </mesh>

      {/* Dark inner core — high detail icosphere for clean silhouette */}
      <mesh>
        <icosahedronGeometry args={[RADIUS * 0.985, 5]} />
        <meshBasicMaterial color="#03070d" />
      </mesh>

      {/* Wireframe lattice with animated shader */}
      <mesh material={latticeMat}>
        <icosahedronGeometry args={[RADIUS, 5]} />
      </mesh>

      {/* Pilot city pins — radar pings + light beams */}
      {cityPositions.map((p, i) => (
        <CityPin
          key={i}
          position={p}
          phase={(i / cityPositions.length) * 1.0}
          visible={1}
        />
      ))}

      {/* Inter-city arcs as flowing tubes */}
      <mesh geometry={arcGeom} material={arcMat} renderOrder={3} />
    </group>
  );
}
