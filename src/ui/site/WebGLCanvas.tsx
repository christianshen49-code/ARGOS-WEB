"use client";

/**
 * WebGLCanvas — thin client-only wrapper around the Three.js Scene.
 *
 * Why this exists: `dynamic({ ssr: false })` is only valid inside Client
 * Components in the Next.js App Router.  layout.tsx is a Server Component,
 * so we can't call `dynamic` there directly.  This wrapper is the Client
 * Component boundary; layout imports THIS file, which then loads Scene
 * lazily with no server-side execution.
 *
 * Three.js objects contain circular references that would crash Next.js's
 * RSC JSON serialiser if Scene were imported directly in a Server Component.
 * ssr:false prevents that entirely — the canvas only ever mounts in the browser.
 */
import dynamic from "next/dynamic";

const Scene = dynamic(
  () => import("@/ui/morph/Scene").then((m) => ({ default: m.Scene })),
  { ssr: false }
);

export function WebGLCanvas() {
  return <Scene />;
}
