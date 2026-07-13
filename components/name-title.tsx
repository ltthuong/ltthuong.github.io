"use client";

import { useEffect, useRef } from "react";

const NAME = Array.from("THƯỞNG");

const INFLUENCE = 300;
const SHOVE = 56;
const K = 92;
const DAMP = 8.6;

export function NameTitle() {
  const wrap = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = wrap.current;
    if (!root) return;

    const letters = Array.from(
      root.querySelectorAll<HTMLSpanElement>("[data-letter]"),
    );
    const solid = root.querySelector<HTMLSpanElement>("[data-solid]");
    if (!solid) return;

    let centers: { x: number; y: number }[] = [];
    const measure = () => {
      centers = letters.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    };

    const measureTimer = setTimeout(measure, 900);
    window.addEventListener("resize", measure);

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let solidX = 0;
    let solidY = 0;
    let solidVx = 0;
    let solidVy = 0;
    const S = letters.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, burst: 0 }));
    let raf = 0;
    let last = performance.now();
    let nextPulse = 2.2;

    const move = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const down = (e: PointerEvent) => {
      if (!centers.length) measure();
      for (let i = 0; i < S.length; i++) {
        const c = centers[i];
        if (!c) continue;
        const dx = c.x - e.clientX;
        const dy = c.y - e.clientY;
        const d = Math.hypot(dx, dy) + 1e-3;
        S[i].vx += (dx / d) * (260 + i * 22);
        S[i].vy += (dy / d) * (210 + i * 18) - 22;
        S[i].burst = 1;
      }
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const t = now / 1000;

      const rootRect = root.getBoundingClientRect();
      const rootCx = rootRect.left + rootRect.width / 2;
      const rootCy = rootRect.top + rootRect.height / 2;
      const parallaxX = ((mx - rootCx) / window.innerWidth) * 24;
      const parallaxY = ((my - rootCy) / window.innerHeight) * 14;

      solidVx += (parallaxX - solidX) * 62 * dt;
      solidVy += (parallaxY - solidY) * 62 * dt;
      const solidDamp = Math.exp(-10 * dt);
      solidVx *= solidDamp;
      solidVy *= solidDamp;
      solidX += solidVx * dt;
      solidY += solidVy * dt;
      solid.style.transform = `translate3d(${solidX}px, ${solidY}px, 0)`;

      if (t > nextPulse) {
        nextPulse = t + 4.6 + Math.random() * 2.2;
        for (let i = 0; i < S.length; i++) {
          S[i].vx += Math.sin(t * 1.7 + i) * 70;
          S[i].vy += Math.cos(t * 1.35 + i) * 42;
          S[i].burst = Math.max(S[i].burst, 0.55);
        }
      }

      for (let i = 0; i < letters.length; i++) {
        const s = S[i];
        const c = centers[i];
        let tx = Math.sin(t * 0.9 - i * 0.52) * 5;
        let ty = Math.cos(t * 0.82 - i * 0.45) * 4;

        if (c) {
          const dx = c.x - mx;
          const dy = c.y - my;
          const d = Math.hypot(dx, dy);
          if (d < INFLUENCE) {
            const f = (1 - d / INFLUENCE) ** 2;
            tx += (dx / (d + 1e-3)) * f * SHOVE;
            ty += (dy / (d + 1e-3)) * f * SHOVE * 0.72;
          }
        }

        s.vx += (tx - s.x) * K * dt;
        s.vy += (ty - s.y) * K * dt;
        const damp = Math.exp(-DAMP * dt);
        s.vx *= damp;
        s.vy *= damp;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.burst *= Math.exp(-3.8 * dt);

        const speed = Math.hypot(s.vx, s.vy);
        const rot = Math.max(-7, Math.min(7, s.vx * 0.018));
        const glow = Math.min(1, speed * 0.006 + s.burst);
        letters[i].style.transform =
          `translate3d(${s.x}px, ${s.y}px, 0) rotate(${rot}deg)`;
        letters[i].style.opacity = `${0.16 + glow * 0.34}`;
        letters[i].style.textShadow =
          `0 0 ${28 + glow * 42}px rgba(255, 48, 86, ${0.18 + glow * 0.28})`;
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
      className="name-title font-display text-[4.75rem] font-semibold leading-none text-[#f5f0ea] sm:text-[7rem] md:text-[9rem] lg:text-[11rem]"
    >
      <span data-solid className="name-solid" aria-hidden>
        {NAME.map((ch, i) => (
          <span key={i} className="solid-mask">
            <span
              className="solid-char"
              style={{ "--d": `${0.18 + i * 0.07}s` } as React.CSSProperties}
            >
              {ch}
            </span>
          </span>
        ))}
      </span>
      <span className="name-halo" aria-hidden>
        {NAME.map((ch, i) => (
          <span
            key={`${ch}-${i}`}
            data-letter
            className="name-halo-letter"
            style={{ animationDelay: `${0.34 + i * 0.075}s` }}
          >
            {ch}
          </span>
        ))}
      </span>
    </h1>
  );
}
