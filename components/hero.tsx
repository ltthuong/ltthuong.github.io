"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { NameTitle } from "@/components/name-title";
import { Cursor } from "@/components/cursor";

const StrokesScene = dynamic(
  () => import("@/components/webgl/strokes-scene").then((m) => m.StrokesScene),
  { ssr: false },
);

export function Hero() {
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );

  return (
    <section className="relative min-h-[100dvh] w-full overflow-hidden bg-[#150a1f]">
      <div className="absolute inset-0">
        {reduced ? <StaticGlow /> : <StrokesScene active />}
      </div>

      {/* the name itself is drawn in particles inside the WebGL scene;
          keep a real heading for SEO/screen readers */}
      {!reduced && <h1 className="sr-only">Thưởng</h1>}

      <div className="hero-copy pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5 px-6">
        {reduced && <NameTitle />}
        <p
          className={`sub-in font-mono text-xs text-[#f5f0ea]/58 md:text-sm ${
            reduced ? "" : "mt-[40vh]"
          }`}
        >
          /tʰɨəŋ/ — means &ldquo;reward&rdquo;
        </p>
      </div>

      <Cursor />
    </section>
  );
}

function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getServerReducedMotionSnapshot() {
  return false;
}

function StaticGlow() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_62%_50%,rgba(160,20,50,0.35),rgba(21,10,31,0)_65%)]" />
  );
}
