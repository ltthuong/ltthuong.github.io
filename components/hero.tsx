"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { NameTitle } from "@/components/name-title";
import { CanvasGuard } from "@/components/webgl/canvas-guard";

const StrokesScene = dynamic(
  () => import("@/components/webgl/strokes-scene").then((m) => m.StrokesScene),
  { ssr: false },
);

const SOCIAL_LINKS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/letienthuong" },
  { label: "GitHub", href: "https://github.com/ltthuong" },
];

export function Hero({ tagline, socialLabel }: { tagline: string; socialLabel: string }) {
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );

  return (
    <section className="relative min-h-[100dvh] w-full overflow-hidden bg-lacquer">
      <div className="absolute inset-0">
        {reduced ? (
          <StaticGlow />
        ) : (
          <CanvasGuard fallback={<StaticGlow />}>
            <StrokesScene active fallback={<StaticGlow />} />
          </CanvasGuard>
        )}
      </div>

      {/* the name itself is drawn in particles inside the WebGL scene;
          keep a real heading for SEO/screen readers */}
      {reduced ? null : <h1 className="sr-only">Thưởng</h1>}

      <div className="hero-copy pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5 px-6">
        {reduced ? <NameTitle /> : null}
        <p
          className={`sub-in text-xs text-eggshell/60 md:text-sm ${reduced ? "" : "mt-[40vh]"}`}
        >
          {tagline}
        </p>
      </div>

      <nav
        aria-label={socialLabel}
        className="pointer-events-auto absolute bottom-7 left-1/2 flex -translate-x-1/2 gap-7 font-mono text-xs text-eggshell/55"
      >
        {SOCIAL_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-gold"
          >
            {link.label}
          </a>
        ))}
      </nav>
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
    <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_62%_50%,rgba(194,50,31,0.22),rgba(11,8,7,0)_65%)]" />
  );
}
