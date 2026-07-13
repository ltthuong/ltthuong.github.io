"use client";

import { useEffect, useRef } from "react";

const NAME = Array.from("THƯỞNG");

const INFLUENCE = 280; // px radius the cursor bends letters within
const SHOVE = 64; // max px displacement
const K = 105; // spring stiffness
const DAMP = 7.6; // spring damping (lower = wobblier)

/* One layer, honest physics: each char is a spring mass. CSS handles the
   masked rise-in + idle wave on the INNER span; JS drives shove/blast/tilt
   on the OUTER mask (moving the mask never clips its child). */
export function NameTitle() {
  const wrap = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = wrap.current;
    if (!root) return;
    const masks = Array.from(
      root.querySelectorAll<HTMLSpanElement>(".solid-mask"),
    );

    let centers: { x: number; y: number }[] = [];
    const measure = () => {
      centers = masks.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    };
    const measureTimer = setTimeout(measure, 1300); // after reveal settles
    window.addEventListener("resize", measure);

    let mx = -9999, my = -9999;
    const S = masks.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
    let raf = 0;
    let last = performance.now();

    const move = (e: PointerEvent) => { mx = e.clientX; my = e.clientY; };

    // click/tap: blast chars away from the hit point
    const down = (e: PointerEvent) => {
      if (!centers.length) measure();
      for (let i = 0; i < S.length; i++) {
        const c = centers[i];
        if (!c) continue;
        const dx = c.x - e.clientX;
        const dy = c.y - e.clientY;
        const d = Math.hypot(dx, dy) + 1e-3;
        const kick = 380 + Math.random() * 320;
        S[i].vx += (dx / d) * kick;
        S[i].vy += (dy / d) * kick - 50;
      }
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;

      for (let i = 0; i < masks.length; i++) {
        const s = S[i];
        const c = centers[i];
        let tx = 0, ty = 0;
        if (c) {
          const dx = c.x - mx;
          const dy = c.y - my;
          const d = Math.hypot(dx, dy);
          if (d < INFLUENCE) {
            const f = (1 - d / INFLUENCE) ** 2;
            tx = (dx / (d + 1e-3)) * f * SHOVE;
            ty = (dy / (d + 1e-3)) * f * SHOVE * 0.75;
          }
        }
        s.vx += (tx - s.x) * K * dt;
        s.vy += (ty - s.y) * K * dt;
        const damp = Math.exp(-DAMP * dt);
        s.vx *= damp;
        s.vy *= damp;
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        const rot = Math.max(-12, Math.min(12, s.vx * 0.028));
        masks[i].style.transform =
          `translate3d(${s.x}px, ${s.y}px, 0) rotate(${rot}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);
    raf = requestAnimationFrame(tick);
    return () => {
      clearTimeout(measureTimer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <h1
      ref={wrap}
      aria-label="Thưởng"
      className="name-title name-solid font-display text-[4.75rem] font-semibold leading-none sm:text-[7rem] md:text-[9rem] lg:text-[10.5rem]"
    >
      {NAME.map((ch, i) => (
        <span key={i} className="solid-mask" aria-hidden>
          <span
            className="solid-char"
            style={{ "--d": `${0.18 + i * 0.07}s` } as React.CSSProperties}
          >
            {ch}
          </span>
        </span>
      ))}
    </h1>
  );
}
