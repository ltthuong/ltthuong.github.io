"use client";

import { useEffect, useRef } from "react";

const NAME = Array.from("Thưởng");
const INFLUENCE = 230; // px radius the cursor bends letters within
const SHOVE = 30; // max px displacement

/* The name reveals letter by letter, then each letter leans away from the
   cursor — the DOM twin of the WebGL stroke shove. */
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
    const offs = letters.map(() => ({ x: 0, y: 0 }));
    let raf = 0;

    const move = (e: PointerEvent) => { mx = e.clientX; my = e.clientY; };

    const tick = () => {
      for (let i = 0; i < letters.length; i++) {
        const c = centers[i];
        let tx = 0, ty = 0;
        if (c) {
          const ddx = c.x - mx;
          const ddy = c.y - my;
          const d = Math.hypot(ddx, ddy);
          if (d < INFLUENCE) {
            const f = (1 - d / INFLUENCE) ** 2;
            tx = (ddx / (d + 1e-3)) * f * SHOVE;
            ty = (ddy / (d + 1e-3)) * f * SHOVE;
          }
        }
        const o = offs[i];
        o.x += (tx - o.x) * 0.14;
        o.y += (ty - o.y) * 0.14;
        letters[i].style.transform = `translate3d(${o.x}px, ${o.y}px, 0) rotate(${o.x * 0.06}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", move, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointermove", move);
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
