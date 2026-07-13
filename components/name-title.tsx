"use client";

import { useEffect, useRef } from "react";

const NAME = Array.from("Thưởng");
// fill = gradient shimmer, outline = hollow italic — the editorial mix
const STYLE: ("fill" | "outline")[] = ["fill", "fill", "outline", "fill", "outline", "fill"];

const INFLUENCE = 260; // px radius the cursor bends letters within
const SHOVE = 74; // max px displacement
const K = 110; // spring stiffness
const DAMP = 7.2; // spring damping (lower = wobblier)

/* Six masses on springs wearing serif glyphs: they ride a traveling wave,
   lean away from the cursor, blast apart on click, shiver on their own,
   and split into RGB ghosts whenever they move fast. */
export function NameTitle() {
  const wrap = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
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
    let nextShiver = -1;

    const move = (e: PointerEvent) => { mx = e.clientX; my = e.clientY; };

    // click/tap: blast every letter away from the hit point
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

      // every few seconds the whole name shivers awake
      if (nextShiver < 0) nextShiver = tt + 4 + Math.random() * 3;
      if (tt > nextShiver) {
        nextShiver = tt + 5 + Math.random() * 4;
        for (const s of S) {
          s.vx += (Math.random() - 0.5) * 300;
          s.vy += (Math.random() - 0.5) * 240;
        }
      }

      for (let i = 0; i < letters.length; i++) {
        const c = centers[i];
        const s = S[i];
        // rest target: a traveling wave, letters surfing left to right
        let tx = Math.sin(tt * 1.15 - i * 0.55) * 9;
        let ty = Math.sin(tt * 0.85 - i * 0.45 + 1.3) * 9;
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

        const waveRot = Math.sin(tt * 0.9 - i * 0.5) * 2.4;
        const rot = waveRot + Math.max(-16, Math.min(16, s.vx * 0.035));
        const skew = Math.max(-10, Math.min(10, -s.vx * 0.02));
        const speed = Math.hypot(s.vx, s.vy);
        const scale = 1 + Math.min(speed * 0.00045, 0.14);
        letters[i].style.transform =
          `translate3d(${s.x}px, ${s.y}px, 0) rotate(${rot}deg) skewX(${skew}deg) scale(${scale})`;

        // chromatic split: ghosts trail opposite the velocity
        const cx = Math.max(-16, Math.min(16, s.vx * 0.04));
        const cy = Math.max(-16, Math.min(16, s.vy * 0.04));
        letters[i].style.textShadow =
          `${-cx}px ${-cy}px 0 rgba(255, 40, 70, 0.5), ` +
          `${cx}px ${cy}px 0 rgba(96, 140, 255, 0.38), ` +
          `0 0 70px rgba(255, 45, 80, 0.33)`;
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
          className={`letter-in inline-block will-change-transform ${
            STYLE[i] === "outline" ? "letter-outline italic" : "letter-fill"
          }`}
          style={{ animationDelay: `${0.35 + i * 0.07}s` }}
        >
          {ch}
        </span>
      ))}
    </h1>
  );
}
