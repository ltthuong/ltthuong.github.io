"use client";

import { useEffect, useMemo } from "react";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Effect } from "postprocessing";
import { Uniform } from "three";
import { PALETTE_GLSL } from "@/lib/palette";

/* Lacquer grade: filmic tone map, then split toning in a perceptual domain
   (shadows lean son, highlights lean vàng nhạt), then dither. */
const gradeFrag = /* glsl */ `
  uniform float uStrength;
  ${PALETTE_GLSL}

  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  vec3 tint(vec3 linearColor) {
    vec3 g = pow(linearColor, vec3(1.0 / 2.2));
    return g / max(dot(g, LUMA), 1e-3);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 g = pow(aces(inputColor.rgb * 1.1), vec3(1.0 / 2.2));
    float l = dot(g, LUMA);
    g = mix(g, g * tint(CINNABAR_DEEP), (1.0 - l) * (1.0 - l) * 0.22 * uStrength);
    g = mix(g, g * tint(GOLD_PALE), l * l * 0.45 * uStrength);
    float n = fract(sin(dot(uv * resolution + time, vec2(12.9898, 78.233))) * 43758.5453);
    g += (n - 0.5) / 255.0;
    outputColor = vec4(pow(max(g, 0.0), vec3(2.2)), inputColor.a);
  }
`;

class LacquerGradeEffect extends Effect {
  constructor(strength: number) {
    super("LacquerGrade", gradeFrag, {
      uniforms: new Map([["uStrength", new Uniform(strength)]]),
    });
  }
}

export function HeroPost() {
  const grade = useMemo(() => new LacquerGradeEffect(1), []);
  useEffect(() => () => grade.dispose(), [grade]);
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        mipmapBlur
        levels={5}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.3}
        intensity={0.65}
        radius={0.75}
      />
      <primitive object={grade} dispose={null} />
    </EffectComposer>
  );
}
