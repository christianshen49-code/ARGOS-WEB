import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disabled: StrictMode's double-effect-invoke causes the WebGL video
  // pipeline to teardown/recreate mid-frame, pausing decode.
  reactStrictMode: false,
  // Hide the floating Next.js dev-tools indicator (the small "N" circle).
  devIndicators: false,
  // GLSL is authored as typed template-string modules (*.glsl.ts),
  // so no custom webpack loader is required.
};

export default nextConfig;
