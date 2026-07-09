"use client";

import { useEffect, useRef } from "react";

/* v2-style cursor: a tight dot + a lagging ring, white via blend-difference.
   Fine pointers only; native cursor is hidden while this is mounted. */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    document.body.classList.add("custom-cursor");
    const d = dot.current!;
    const r = ring.current!;
    let x = innerWidth / 2, y = innerHeight / 2;
    let dx = x, dy = y, rx = x, ry = y;
    let scale = 1, target = 1;
    let raf = 0;

    const move = (e: PointerEvent) => { x = e.clientX; y = e.clientY; };
    const down = () => (target = 0.72);
    const up = () => (target = 1);

    const tick = () => {
      dx += (x - dx) * 0.5;
      dy += (y - dy) * 0.5;
      rx += (x - rx) * 0.14;
      ry += (y - ry) * 0.14;
      scale += (target - scale) * 0.2;
      // the ring stretches along its lag vector, like a droplet in motion
      const lx = x - rx;
      const ly = y - ry;
      const lag = Math.hypot(lx, ly);
      const stretch = Math.min(lag * 0.014, 0.85);
      const ang = Math.atan2(ly, lx);
      d.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%) scale(${1 + stretch * 0.6})`;
      r.style.transform =
        `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%) ` +
        `rotate(${ang}rad) scale(${(1 + stretch) * scale}, ${Math.max(0.55, 1 - stretch * 0.4) * scale})`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    raf = requestAnimationFrame(tick);
    return () => {
      document.body.classList.remove("custom-cursor");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] hidden [@media(pointer:fine)]:block" aria-hidden>
      <div
        ref={dot}
        className="absolute left-0 top-0 h-2 w-2 rounded-full bg-white mix-blend-difference"
      />
      <div
        ref={ring}
        className="absolute left-0 top-0 h-9 w-9 rounded-full border border-white/80 mix-blend-difference"
      />
    </div>
  );
}
