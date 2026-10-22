import { Color } from "three";

/* Lacquer palette. Mirrors the @theme tokens in app/globals.css. */
export const PALETTE = {
  lacquer: "#0B0807",
  lacquer2: "#16100D",
  cinnabar: "#C2321F",
  cinnabarDeep: "#5E160F",
  gold: "#D9A441",
  goldPale: "#F1D89A",
  eggshell: "#ECE6D8",
  muted: "#9A9184",
} as const;

type Token = keyof typeof PALETTE;

function vec3(token: Token): string {
  const c = new Color(PALETTE[token]);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
}

/* Linear-space constants + a then -> son -> vàng -> vàng nhạt gradient map. */
export const PALETTE_GLSL = /* glsl */ `
  const vec3 LACQUER = ${vec3("lacquer")};
  const vec3 LACQUER_2 = ${vec3("lacquer2")};
  const vec3 CINNABAR = ${vec3("cinnabar")};
  const vec3 CINNABAR_DEEP = ${vec3("cinnabarDeep")};
  const vec3 GOLD = ${vec3("gold")};
  const vec3 GOLD_PALE = ${vec3("goldPale")};
  const vec3 EGGSHELL = ${vec3("eggshell")};

  vec3 lacquerRamp(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c = mix(LACQUER, CINNABAR_DEEP, smoothstep(0.0, 0.25, t));
    c = mix(c, CINNABAR, smoothstep(0.2, 0.5, t));
    c = mix(c, GOLD, smoothstep(0.45, 0.8, t));
    return mix(c, GOLD_PALE, smoothstep(0.75, 1.0, t));
  }
`;
