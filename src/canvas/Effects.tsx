"use client";

import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
  ChromaticAberration,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";

/**
 * Cinematic post-processing stack.
 *
 *   • Bloom — additive-blended scene elements bleed their light. Threshold
 *     low and intensity high so cyan/accent rims feel incandescent.
 *   • Chromatic aberration — sub-pixel R/B split, tight enough to feel like
 *     a real lens rather than a glitch.
 *   • Vignette — pulls focus to centre, gives every section a frame.
 *   • Noise — barely-perceptible film grain so dark areas don't band.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.7}
        luminanceThreshold={0.55}
        luminanceSmoothing={0.32}
        mipmapBlur
        radius={0.8}
      />
      <ChromaticAberration
        offset={new THREE.Vector2(0.00055, 0.00055)}
        radialModulation={true}
        modulationOffset={0.42}
        blendFunction={BlendFunction.NORMAL}
      />
      <Vignette
        offset={0.34}
        darkness={0.55}
        blendFunction={BlendFunction.NORMAL}
      />
      <Noise opacity={0.04} blendFunction={BlendFunction.OVERLAY} />
    </EffectComposer>
  );
}
