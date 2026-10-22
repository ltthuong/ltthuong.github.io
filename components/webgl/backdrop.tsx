"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE_GLSL } from "@/lib/palette";
import { LAMP_GLSL, lampUniforms } from "./shaders/lamp";
import { hero } from "./hero-store";

/* Wet lacquer: near-black then with a faint son depth. Under the lamp the
   eggshell craquelure inlaid below the surface shows through. */

const vert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const frag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorld;
  uniform float uTime;
  uniform float uAspect;
  ${PALETTE_GLSL}
  ${LAMP_GLSL}

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 hash2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
    return v;
  }

  // eggshell inlay: thin voronoi edges (F2 - F1)
  float craquelure(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 r = g + hash2(i + g) * 0.85 - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    }
    return 1.0 - smoothstep(0.0, 0.05, sqrt(d2) - sqrt(d1));
  }

  void main() {
    vec2 p = vec2(vUv.x * uAspect, vUv.y);
    float n = fbm(p * 2.2 + vec2(uTime * 0.012, -uTime * 0.008));
    vec3 col = mix(LACQUER, LACQUER_2, n);
    col += CINNABAR_DEEP * 0.10 * smoothstep(1.0, 0.0, vUv.y) * n;

    vec3 rd = normalize(vWorld - cameraPosition);
    float s = lampScatter(cameraPosition, rd, distance(vWorld, cameraPosition));
    float halo = (1.0 - exp(-pow(s * 0.25, 2.0))) * uLampOn;

    float crack = craquelure(p * 13.0 + n * 0.5);
    col += EGGSHELL * crack * pow(halo, 1.4) * 0.07;
    col += GOLD * pow(halo, 2.0) * 0.12;

    col *= 0.6 + 0.4 * smoothstep(1.3, 0.3, distance(vUv, vec2(0.5)));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const PLANE_Z = -8;

export function Backdrop() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { viewport } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAspect: { value: 1 },
      ...lampUniforms(),
    }),
    [],
  );
  const dist = 10 - PLANE_Z;
  const h = 2 * Math.tan((45 * Math.PI) / 360) * dist * 1.25;
  const w = h * Math.max(viewport.aspect, 1) * 1.25;

  useFrame((state) => {
    const m = mat.current;
    if (!m) {
      return;
    }
    const u = m.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uAspect.value = w / h;
    u.uLampOn.value = hero.lampOn;
  });

  return (
    <mesh position={[0, 0, PLANE_Z]}>
      <planeGeometry args={[w, h]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={vert}
        fragmentShader={frag}
        depthWrite={false}
      />
    </mesh>
  );
}
