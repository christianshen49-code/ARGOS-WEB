"use client";

import { Canvas } from "@react-three/fiber";
import { useCursorVelocity } from "@/hooks/useCursorVelocity";
import { Scene } from "./Scene";

/**
 * The single, persistent <Canvas> for the entire site. Mounted once in the
 * root layout so the WebGL context is never torn down between routes — page
 * changes are handled inside the scene graph via camera moves / shader
 * dissolves.
 */
export function CanvasRoot() {
  useCursorVelocity();

  return (
    <div className="canvas-root">
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 100 }}
        flat
      >
        <color attach="background" args={["#05060a"]} />
        <Scene />
      </Canvas>
    </div>
  );
}
