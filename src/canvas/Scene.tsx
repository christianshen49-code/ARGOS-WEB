"use client";

import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HeroVideoPlane } from "@/scenes/hero/HeroVideoPlane";
import { NodesGlobe } from "@/scenes/globe/NodesGlobe";
import { Starfield } from "@/scenes/globe/Starfield";
import { AmbientField } from "./AmbientField";
import { CameraRig } from "./CameraRig";
import { CursorRibbon } from "./CursorRibbon";
import { Effects } from "./Effects";
import { choreo } from "./choreography";

/**
 * Scene composition.
 *
 *   <CameraRig/>      — owns camera position + look-at every frame
 *   <Starfield/>      — far world-space depth shell, ~R 18–28
 *   <HeroSection/>    — hero plane group (scale ← choreo.heroScale)
 *   <GlobeSection/>   — globe group (z ← choreo.globeZ, scale ← choreo.globeScale)
 *   <AmbientField/>   — 1500 3D particles around z=0, parallaxes with camera
 *   <CursorRibbon/>   — overlay
 *   <Effects/>        — post stack
 */
function HeroSection() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.scale.setScalar(choreo.heroScale);
  });
  return (
    <group ref={ref}>
      <HeroVideoPlane />
    </group>
  );
}

function GlobeSection() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.z = choreo.globeZ;
    ref.current.scale.setScalar(choreo.globeScale);
  });
  return (
    <group ref={ref}>
      <NodesGlobe />
    </group>
  );
}

export function Scene() {
  return (
    <>
      <CameraRig />
      <Starfield />
      <Suspense fallback={null}>
        <HeroSection />
      </Suspense>
      <GlobeSection />
      <AmbientField />
      <CursorRibbon />
      <Effects />
    </>
  );
}
