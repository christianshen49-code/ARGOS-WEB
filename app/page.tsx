import { Nav } from "@/ui/site/Nav";
import { Hero } from "@/ui/site/Hero";
import { Pillars } from "@/ui/site/Pillars";
import { Nodes } from "@/ui/site/Nodes";
import { FinalCta } from "@/ui/site/FinalCta";
import { ScrollProgress } from "@/ui/site/ScrollProgress";
import { IntroCurtain } from "@/ui/site/IntroCurtain";
import { SmoothScroll } from "@/ui/site/SmoothScroll";
import { ScrollController } from "@/ui/site/ScrollController";

export default function HomePage() {
  return (
    <main>
      <SmoothScroll />
      {/* ScrollController registers GSAP scroll triggers AFTER SmoothScroll
          has wired Lenis ↔ ScrollTrigger. Deferred 1 rAF internally. */}
      <ScrollController />
      {/* Three.js particle canvas lives in layout.tsx (persists across routes).
          ScrollController's GSAP Phase 2b still fades #three-scene in here. */}
      <IntroCurtain />
      <ScrollProgress />
      <Nav />
      <Hero />
      <Pillars />
      <Nodes />
      <FinalCta />
    </main>
  );
}
