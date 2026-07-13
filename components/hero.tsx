"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { NameTitle } from "@/components/name-title";
import { Cursor } from "@/components/cursor";

const StrokesScene = dynamic(
  () => import("@/components/webgl/strokes-scene").then((m) => m.StrokesScene),
  { ssr: false },
);

export function Hero() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  return (
    <section className="relative h-[100dvh] w-full overflow-hidden bg-[#150a1f]">
      <div className="absolute inset-0">
        {reduced ? <StaticGlow /> : <StrokesScene active />}
      </div>

      {/* the name IS the headline — v2.lusion.co composition */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6">
        <NameTitle />
        <p className="sub-in font-mono text-xs tracking-[0.22em] text-[#f5f0ea]/55 md:text-sm">
          /tʰɨə̯ŋ/ — means &ldquo;reward&rdquo;
        </p>
      </div>

      <Cursor />
    </section>
  );
}

function StaticGlow() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_62%_50%,rgba(160,20,50,0.35),rgba(21,10,31,0)_65%)]" />
  );
}
