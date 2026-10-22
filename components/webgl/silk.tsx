"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE_GLSL } from "@/lib/palette";
import { LAMP_GLSL, lampUniforms } from "./shaders/lamp";
import { hero } from "./hero-store";
import { NAME_W, NAME_Y } from "./name-sim";
import { NAME_SPACE_GLSL, NODES, SILK_GLSL, createSilkSim, type SilkSim } from "./silk-sim";

/* Draws the simulated silk: one instanced strip per ribbon, smoothed between
   sim nodes with Catmull-Rom, cupped across its width, shaded in luminance
   and mapped through the lacquer ramp so the whole room shares one tone. */

const ALONG = (NODES - 1) * 4 + 1;
const ACROSS = 6;
const MAX_STEPS = 3;
const RIM = { RIM: "" };
const WARM_STEPS = 300;
const LAMP_VEL_MAX = 6;

const vert = /* glsl */ `
  uniform sampler2D uPos;
  uniform sampler2D uSide;
  ${SILK_GLSL}
  varying vec3 vN;
  varying vec3 vT;
  varying vec3 vWorld;
  varying float vV;
  varying float vDepth;
  varying float vTint;

  vec4 node(int i, int j) {
    return texelFetch(uPos, ivec2(clamp(i, 0, NODES - 1), j), 0);
  }

  void main() {
    int j = gl_InstanceID;
    float f = uv.x * float(NODES - 1);
    int i = min(int(f), NODES - 2);
    float t = f - float(i);
    vec3 p0 = node(i - 1, j).xyz;
    vec3 p1 = node(i, j).xyz;
    vec3 p2 = node(i + 1, j).xyz;
    vec3 p3 = node(i + 2, j).xyz;
    vec3 a = 2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3;
    vec3 b = -p0 + 3.0 * p1 - 3.0 * p2 + p3;
    vec3 c = 0.5 * (2.0 * p1 + (p2 - p0) * t + a * t * t + b * t * t * t);
    vec3 T = normalize((p2 - p0) + 2.0 * a * t + 3.0 * b * t * t + 1e-6);

    vec3 s = mix(texelFetch(uSide, ivec2(i, j), 0).xyz, texelFetch(uSide, ivec2(i + 1, j), 0).xyz, t);
    s = normalize(s - T * dot(s, T) + 1e-6);
    vec3 n = cross(T, s);

    // born and retired by width, never by a fade of brightness
    float life = node(0, j).w;
    float width = ribbonWidth(j)
      * mix(0.45, 1.0, pow(max(sin(3.14159 * uv.x), 0.0), 0.3))
      * (1.0 - smoothstep(0.985, 1.0, life))
      * smoothstep(0.0, 0.03 + 0.06 * uv.x, life);

    // silk cups across its width
    float v = uv.y * 2.0 - 1.0;
    vec3 p = c + s * v * width + n * (v * v - 0.33) * width * 0.12;

    vN = n - s * (0.15 * v);
    vT = T;
    vV = v;
    vTint = trait(j, 3u);
    vWorld = p;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */ `
  precision highp float;
  varying vec3 vN;
  varying vec3 vT;
  varying vec3 vWorld;
  varying float vV;
  varying float vDepth;
  varying float vTint;
  ${PALETTE_GLSL}
  ${LAMP_GLSL}
  ${NAME_SPACE_GLSL}

  const vec3 KEY = vec3(-0.42, 0.62, 0.66);

  // thread-aligned lustre: brightest where the threads lie across the half vector
  float lustre(vec3 T, vec3 L, vec3 V, float k) {
    float th = dot(T, normalize(L + V));
    return pow(sqrt(max(1.0 - th * th, 0.0)), k);
  }

  void main() {
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 n = normalize(vN);
    float facing = dot(n, V);
    if (facing < 0.0) {
      n = -n;
    }
    vec3 T = normalize(vT);
    vec3 L = normalize(KEY);

    float key = max((dot(n, L) + 0.4) / 1.4, 0.0);
    float gloss = pow(max(dot(n, normalize(L + V)), 0.0), 22.0);
    float aniso = lustre(T, L, V, 40.0) * smoothstep(-0.1, 0.5, dot(n, L));

    vec3 dl = uLamp - vWorld;
    float lamp = lampDirect(vWorld, 0.3) * 5.0;
    vec3 Ll = normalize(dl);
    float lampLit = max((dot(n, Ll) + 0.3) / 1.3, 0.0) * lamp;
    float lampGloss = (pow(max(dot(n, normalize(Ll + V)), 0.0), 18.0) + lustre(T, Ll, V, 30.0) * 0.5) * lamp;

    float rim = pow(1.0 - abs(facing), 4.0);
    float lum = 0.02 + key * 0.08 + gloss * 0.4 + aniso * 0.08 + rim * 0.04 + lampLit * 0.25 + lampGloss * 0.35;
    lum *= (facing < 0.0 ? 0.7 : 1.0) * mix(0.85, 1.15, vTint);
    lum *= mix(0.3, 1.0, smoothstep(20.0, 12.0, vDepth));
    // silk passing behind the name falls into its shadow
    lum *= mix(0.35, 1.0, smoothstep(0.7, 1.6, length(nameSpace(vWorld))));
    vec3 col = lacquerRamp(lum);

    float s = lampScatter(cameraPosition, -V, distance(vWorld, cameraPosition));
    float halo = (1.0 - exp(-pow(s * 0.25, 2.0))) * uLampOn;
    col += GOLD * pow(halo, 2.0) * 0.12;

    // about one pixel of coverage at the edge, whatever the ribbon's width or twist;
    // cores are drawn first, then the soft rims over whatever silk lies behind
    float alpha = clamp((1.0 - abs(vV)) / max(fwidth(vV) * 1.25, 1e-4), 0.0, 1.0);
    #ifdef RIM
    if (alpha >= 1.0) {
      discard;
    }
    #else
    if (alpha < 1.0) {
      discard;
    }
    #endif
    gl_FragColor = vec4(col, alpha);
  }
`;

export function Silk({ count }: { count: number }) {
  const { gl } = useThree();
  const sim = useRef<SilkSim | null>(null);
  const warm = useRef(false);
  const core = useRef<THREE.ShaderMaterial>(null);
  const rim = useRef<THREE.ShaderMaterial>(null);

  const geo = useMemo(() => {
    const strip = new THREE.PlaneGeometry(1, 1, ALONG - 1, ACROSS - 1);
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex(strip.getIndex());
    g.setAttribute("uv", strip.getAttribute("uv"));
    g.setAttribute("position", strip.getAttribute("position"));
    g.instanceCount = count;
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uPos: { value: null as THREE.Texture | null },
      uSide: { value: null as THREE.Texture | null },
      uName: { value: new THREE.Vector4() },
      ...lampUniforms(),
    }),
    [],
  );

  useEffect(() => {
    const s = createSilkSim(gl, count);
    sim.current = s;
    warm.current = false;
    return () => {
      sim.current = null;
      s.dispose();
    };
  }, [gl, count]);

  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((state, delta) => {
    const s = sim.current;
    if (!s) {
      return;
    }
    const aspect = state.viewport.aspect;
    // landscape: the breeze crosses the room; portrait: it rises through it
    const t = THREE.MathUtils.smoothstep(aspect, 0.7, 1.3);
    s.u.uWind.value.set(THREE.MathUtils.lerp(0.35, 1, t), THREE.MathUtils.lerp(1, 0.35, t)).normalize();
    s.u.uAspect.value = aspect;
    s.u.uNow.value = state.clock.elapsedTime;
    s.u.uLampOn.value = hero.lampOn;
    s.u.uLampVel.value.copy(hero.lampVel);
    if (s.u.uLampVel.value.length() > LAMP_VEL_MAX) {
      s.u.uLampVel.value.setLength(LAMP_VEL_MAX);
    }
    s.u.uBurstT.value = hero.burstT;
    s.u.uBurst.value.set(hero.burstX, hero.burstY);

    if (!warm.current) {
      warm.current = true;
      s.seed(WARM_STEPS);
    }
    let rem = Math.min(delta, MAX_STEPS / 60);
    while (rem > 1e-4) {
      const dt = Math.min(rem, 1 / 60);
      rem -= dt;
      s.step(dt);
    }

    // R3F copies the uniforms into each material, so both passes are fed
    const scale = Math.min(1, (state.viewport.width * 0.88) / NAME_W);
    for (const m of [core.current, rim.current]) {
      if (!m) {
        continue;
      }
      const mu = m.uniforms;
      mu.uPos.value = s.pos();
      mu.uSide.value = s.side();
      mu.uLampOn.value = hero.lampOn;
      mu.uName.value.set(0, NAME_Y, NAME_W * 0.53 * scale, 1.1 * scale);
    }
  });

  return (
    <>
      <mesh geometry={geo} frustumCulled={false} renderOrder={-2}>
        <shaderMaterial
          ref={core}
          uniforms={uniforms}
          vertexShader={vert}
          fragmentShader={frag}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={geo} frustumCulled={false} renderOrder={-1}>
        <shaderMaterial
          ref={rim}
          uniforms={uniforms}
          defines={RIM}
          vertexShader={vert}
          fragmentShader={frag}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}
