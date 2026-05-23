import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { WebGLCanvas } from "@/ui/site/WebGLCanvas";
import { GlobalScrollSync } from "@/ui/site/GlobalScrollSync";
import { RouteSync } from "@/ui/site/RouteSync";
import { PageTransitionOverlay } from "@/ui/site/PageTransitionOverlay";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ARGOS — Headless Infrastructure for AI-Native Commerce",
  description:
    "Autonomous Reception & Growth Orchestration System. Elite AI-model routing on H200 compute, high-fidelity rendering, and automated workflow-as-a-service for premium brands.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {/* WebGL canvas — persists across ALL routes so the context is never
            destroyed on navigation. Loaded client-only via WebGLCanvas wrapper
            (dynamic ssr:false inside a "use client" component). */}
        <WebGLCanvas />
        {/* Global Lenis singleton + mathematical scrollState driver.
            Declared before RouteSync so sibling effects fire in order:
            GlobalScrollSync → RouteSync (critical for restoration tween). */}
        <GlobalScrollSync />
        {/* Keeps scrollStore.isPricing in sync with the active pathname and
            GSAP-fades the canvas into view on /pricing. */}
        <RouteSync />
        {/* Hyperspace Warp radial overlay — intercepts TransitionLink clicks. */}
        <PageTransitionOverlay />
        {children}
      </body>
    </html>
  );
}
