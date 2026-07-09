"use client";

import { useEffect, useRef } from "react";

const NAME = Array.from("Thưởng");
const INFLUENCE = 260; // px radius the cursor bends letters within
const SHOVE = 74; // max px displacement
const K = 110; // spring stiffness
const DAMP = 7.2; // spring damping (lower = wobblier)

/* The name reveals letter by letter, then behaves like six masses on
   springs: the cursor shoves them, clicks blast them apart, and they
   wobble back home with real inertia. */
export function NameTitle() {
  const wrap = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const letters = Array.from(
      wrap.current!.querySelectorAll<HTMLSpanElement>("[data-letter]"),
    );
    let centers: { x: number; y: number }[] = [];
    const measure = () => {
      centers = letters.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    };
    // measure after the reveal animation settles (transforms don't move rects)
    const t = setTimeout(measure, 1400);
    window.addEventListener("resize", measure);

    let mx = -9999, my = -9999;
    const S = letters.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
    let raf = 0;
    let last = performance.now();

    const move = (e: PointerEvent) => { mx = e.clientX; my = e.clientY; };

    // click: blast every letter away from the click point
    const down = (e: PointerEvent) => {
      if (!centers.length) measure();
      for (let i = 0; i < S.length; i++) {
        const c = centers[i];
        if (!c) continue;
        const ddx = c.x - e.clientX;
        const ddy = c.y - e.clientY;
        const d = Math.hypot(ddx, ddy) + 1e-3;
        const kick = 420 + Math.random() * 380;
        S[i].vx += (ddx / d) * kick;
        S[i].vy += (ddy / d) * kick - 60; // slight upward flair
      }
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const tt = now / 1000;

      for (let i = 0; i < letters.length; i++) {
        const c = centers[i];
        const s = S[i];
        // rest target: gentle idle bob so the name is never frozen
        let tx = Math.sin(tt * 0.9 + i * 1.15) * 4;
        let ty = Math.cos(tt * 0.7 + i * 0.9) * 5;
        if (c) {
          const ddx = c.x - mx;
          const ddy = c.y - my;
          const d = Math.hypot(ddx, ddy);
          if (d < INFLUENCE) {
            const f = (1 - d / INFLUENCE) ** 2;
            tx += (ddx / (d + 1e-3)) * f * SHOVE;
            ty += (ddy / (d + 1e-3)) * f * SHOVE;
          }
        }
        // spring integration → overshoot + wobble
        s.vx += (tx - s.x) * K * dt;
        s.vy += (ty - s.y) * K * dt;
        const damp = Math.exp(-DAMP * dt);
        s.vx *= damp;
        s.vy *= damp;
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        const rot = Math.max(-16, Math.min(16, s.vx * 0.035));
        const speed = Math.hypot(s.vx, s.vy);
        const scale = 1 + Math.min(speed * 0.00045, 0.14);
        letters[i].style.transform =
          `translate3d(${s.x}px, ${s.y}px, 0) rotate(${rot}deg) scale(${scale})`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);
    raf = requestAnimationFrame(tick);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <h1
      ref={wrap}
      className="name-glow font-display text-[clamp(4rem,14vw,11rem)] font-normal leading-none tracking-[-0.01em] text-[#f5f0ea]"
    >
      {NAME.map((ch, i) => (
        <span
          key={i}
          data-letter
          className="letter-in inline-block will-change-transform"
          style={{ animationDelay: `${0.35 + i * 0.07}s` }}
        >
          {ch}
        </span>
      ))}
    </h1>
  );
}
