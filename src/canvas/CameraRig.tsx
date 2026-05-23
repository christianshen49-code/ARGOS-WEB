"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useArgosStore } from "@/store/useArgosStore";
import { choreo } from "./choreography";

/**
 * Drives the camera each frame from two sources:
 *
 *   1. {@link choreo.camYaw} — the choreography's orbit angle. In the final
 *      scroll phase it ramps to ~0.28 rad (≈ 16°), sweeping the camera
 *      around the origin so the globe looks at us from a new angle.
 *   2. The smoothed cursor — adds a small positional offset *and* a
 *      complementary look-at offset, so the camera both translates and
 *      tilts. That combination is what gives the scene a real parallax /
 *      "head movement" sense of 3D perspective, instead of feeling like a
 *      flat picture that just slides around.
 *
 * Owning the camera centrally also means individual section components
 * never fight over `camera.position` — everything else just reads from the
 * camera and renders.
 */
export function CameraRig() {
  const { camera } = useThree();

  // Allocate scratch vectors once
  const targetPos = useMemo(() => new THREE.Vector3(0, 0, 5), []);
  const targetLook = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const currentLook = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  useFrame(() => {
    const { cursor } = useArgosStore.getState();

    // Orbit from the choreography
    const orbitX = Math.sin(choreo.camYaw) * 5;
    const orbitZ = Math.cos(choreo.camYaw) * 5;

    // Cursor parallax — small spatial offset
    const parX = cursor.x * 0.5;
    const parY = cursor.y * 0.35;

    targetPos.set(orbitX + parX, parY, orbitZ);
    camera.position.lerp(targetPos, 0.06);

    // Look-at offsets in the opposite-ish proportion so the camera rotates
    // a touch toward where the cursor is pointing — the parallax becomes
    // genuine perspective, not just translation.
    targetLook.set(parX * 0.35, parY * 0.35, 0);
    currentLook.lerp(targetLook, 0.06);
    camera.lookAt(currentLook);
  });

  return null;
}
