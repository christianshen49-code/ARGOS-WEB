"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useArgosStore } from "@/store/useArgosStore";
import { choreo } from "@/canvas/choreography";
import { heroFragmentShader, heroVertexShader } from "./heroVideo.glsl";

const HERO_VIDEO_SRC = "/video/argos-hero.mp4";

/**
 * Full-viewport plane that renders the hero promo video through the custom
 * GLSL pipeline. The `<video>` is appended to the DOM (visually hidden but
 * laid out) so Chrome keeps the decoder alive — off-DOM videos play but
 * produce no frames for texImage2D. `texture.needsUpdate` is flagged each
 * frame as the canonical fallback for unreliable rVFC on detached elements.
 */
export function HeroVideoPlane() {
  const { viewport, size } = useThree();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const textureRef = useRef<THREE.VideoTexture | null>(null);

  const placeholderTexture = useMemo(() => {
    const data = new Uint8Array([5, 6, 10, 255]);
    const t = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTexture: { value: placeholderTexture as THREE.Texture },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uVelocity: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uVideoAspect: { value: 16 / 9 },
      uReady: { value: 0 },
      uScrollOut: { value: 0 },
    }),
    [placeholderTexture],
  );

  useEffect(() => {
    const video = document.createElement("video");
    video.src = HERO_VIDEO_SRC;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.autoplay = true;
    video.style.cssText =
      "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(video);
    videoRef.current = video;

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    textureRef.current = texture;
    uniforms.uTexture.value = texture;

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
      videoRef.current = null;
      textureRef.current = null;
      uniforms.uTexture.value = placeholderTexture;
    };
  }, [uniforms, placeholderTexture]);

  useFrame((_, delta) => {
    const clamped = Math.min(delta, 0.05);
    uniforms.uTime.value += clamped;
    uniforms.uResolution.value.set(size.width, size.height);

    const video = videoRef.current;
    const texture = textureRef.current;
    if (
      video &&
      texture &&
      video.readyState >= 2 &&
      video.videoWidth > 0
    ) {
      texture.needsUpdate = true;
      uniforms.uVideoAspect.value = video.videoWidth / video.videoHeight;
      uniforms.uReady.value = THREE.MathUtils.lerp(
        uniforms.uReady.value,
        1,
        clamped * 1.6,
      );
    }

    // Scroll-driven dissolve — read straight off the choreography singleton
    uniforms.uScrollOut.value = choreo.heroDissolve;

    const { cursor, velocity } = useArgosStore.getState();
    uniforms.uMouse.value.x = THREE.MathUtils.lerp(
      uniforms.uMouse.value.x,
      cursor.x,
      0.12,
    );
    uniforms.uMouse.value.y = THREE.MathUtils.lerp(
      uniforms.uMouse.value.y,
      cursor.y,
      0.12,
    );
    uniforms.uVelocity.value = THREE.MathUtils.lerp(
      uniforms.uVelocity.value,
      velocity,
      0.1,
    );
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        vertexShader={heroVertexShader}
        fragmentShader={heroFragmentShader}
        uniforms={uniforms}
        toneMapped={false}
      />
    </mesh>
  );
}
