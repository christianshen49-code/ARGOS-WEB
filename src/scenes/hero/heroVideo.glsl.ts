/**
 * GLSL for the hero video plane.
 *
 * The 20-second promo is uploaded as a VideoTexture and treated as raw signal,
 * not a <video> element: the fragment shader applies cover-fit framing, barrel
 * (CRT) distortion, cursor-driven fluid displacement, radial chromatic
 * aberration, scanlines and film grain. Distortion magnitude is modulated by
 * the smoothed cursor velocity uniform.
 */

export const heroVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const heroFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2  uMouse;        // smoothed cursor, range [-1, 1]
  uniform float uVelocity;     // smoothed cursor speed, range [0, 1]
  uniform vec2  uResolution;   // canvas size in device pixels
  uniform float uVideoAspect;  // texture width / height
  uniform float uReady;        // 0 -> 1 fade-in once the video has frames
  uniform float uScrollOut;    // 0 -> 1 noise-edge dissolve driven by scroll

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Scale UVs so the video covers the viewport without distortion.
  vec2 coverUv(vec2 uv, float screenAspect, float texAspect) {
    vec2 s = vec2(1.0);
    if (screenAspect > texAspect) {
      s.y = texAspect / screenAspect;
    } else {
      s.x = screenAspect / texAspect;
    }
    return (uv - 0.5) * s + 0.5;
  }

  void main() {
    float screenAspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 uv = coverUv(vUv, screenAspect, uVideoAspect);

    // --- barrel / CRT lens distortion ---
    vec2 cc = uv - 0.5;
    float r2 = dot(cc, cc);
    float barrel = 1.0 + r2 * (0.10 + uVelocity * 0.22);
    uv = cc * barrel + 0.5;

    // --- cursor-driven fluid displacement ---
    vec2 m = uMouse * 0.5 + 0.5;
    float d = distance(vUv, m);
    float ripple = sin(d * 26.0 - uTime * 3.0) * exp(-d * 5.0);
    vec2 flow = vec2(
      noise(uv * 4.0 + uTime * 0.15),
      noise(uv * 4.0 - uTime * 0.12)
    ) - 0.5;
    float disp = (ripple * 0.6 + length(flow) * 0.4) * (0.010 + uVelocity * 0.055);
    uv += flow * disp;

    // --- radial chromatic aberration, scaled by velocity + edge distance ---
    vec2 dir = normalize(cc + 1e-5);
    float ca = (0.0016 + uVelocity * 0.011) * (0.35 + r2 * 2.0);
    float rC = texture2D(uTexture, uv + dir * ca).r;
    float gC = texture2D(uTexture, uv).g;
    float bC = texture2D(uTexture, uv - dir * ca).b;
    vec3 col = vec3(rC, gC, bC);

    // --- scanlines ---
    float scan = 0.93 + 0.07 * sin(vUv.y * uResolution.y * 1.4 + uTime * 2.0);
    col *= scan;

    // --- film grain ---
    float grain = hash(vUv * uResolution + fract(uTime));
    col += (grain - 0.5) * 0.055;

    // --- cyber tint + cursor proximity glow ---
    col = mix(col, col * vec3(0.80, 0.95, 1.18), 0.35);
    col += vec3(0.10, 0.36, 0.62) * exp(-d * 6.0) * uVelocity * 0.65;

    // --- vignette ---
    col *= smoothstep(1.0, 0.18, r2 * 1.7);

    // letterbox anything sampled outside the texture to pure black
    vec2 g = step(vec2(0.0), uv) * step(uv, vec2(1.0));
    col *= g.x * g.y;

    // fade in once the video is decoding
    col *= clamp(uReady, 0.0, 1.0);

    // scroll-driven noise dissolve — erodes pixels from low-noise areas first
    float dissN = noise(vUv * 12.0 + uTime * 0.2);
    float dissAlpha = smoothstep(uScrollOut, uScrollOut + 0.16, dissN);
    col *= dissAlpha;

    gl_FragColor = vec4(col, 1.0);
  }
`;
