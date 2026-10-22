"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PALETTE_GLSL } from "@/lib/palette";
import { LAMP_GLSL, lampUniforms } from "./shaders/lamp";
import { introStarted } from "@/lib/intro";
import { hero } from "./hero-store";
import { COUNT, HASH_GLSL, NAME_W, NAME_Y, TEX, createNameSim, loadNameMask, type NameSim } from "./name-sim";

const MAX_STEPS = 3;

/* Attribute-less points: gl_VertexID picks the particle's texel. */
const vert = /* glsl */ `
  uniform sampler2D uPosTex;
  uniform sampler2D uVelTex;
  uniform float uScale;
  uniform float uSize;
  uniform float uTime;
  ${LAMP_GLSL}
  ${HASH_GLSL}
  varying float vSpeed;
  varying float vLit;
  varying float vSpark;
  void main() {
    ivec2 c = ivec2(gl_VertexID % ${TEX}, gl_VertexID / ${TEX});
    vec3 p = texelFetch(uPosTex, c, 0).xyz;
    vec3 v = texelFetch(uVelTex, c, 0).xyz;
    vSpeed = clamp((abs(v.x) + abs(v.y)) * 0.5, 0.0, 1.0);
    vec4 w = modelMatrix * vec4(p, 1.0);
    vLit = lampDirect(w.xyz, 1.1);
    // gold leaf: each flake catches the lamp on its own slow beat
    uint s = uint(gl_VertexID);
    float h = rnd(s);
    float beat = 0.5 + 0.5 * sin(uTime * (0.6 + h * 1.4) + h * 40.0);
    vSpark = pow(beat, 24.0) * vLit;
    vec4 mv = viewMatrix * w;
    gl_PointSize = uSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */ `
  uniform float uDensity;
  varying float vSpeed;
  varying float vLit;
  varying float vSpark;
  ${PALETTE_GLSL}
  void main() {
    float alpha = smoothstep(0.5, 0.18, length(gl_PointCoord - 0.5));
    vec3 col = mix(GOLD, CINNABAR, smoothstep(0.08, 0.45, vSpeed));
    col = mix(col, GOLD_PALE, smoothstep(0.55, 1.0, vSpeed) * 0.5);
    col *= 0.42 + vLit * 1.1 + vSpeed * 0.25;
    col += GOLD_PALE * vSpark * 2.0;
    gl_FragColor = vec4(col, alpha * 0.17 * uDensity);
  }
`;

function smooth01(x: number) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

export function NameParticles() {
  const { gl } = useThree();
  const sim = useRef<NameSim | null>(null);
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const local = useRef({
    born: -1,
    whip: 0,
    ready: false,
    prev: new THREE.Vector2(9999, 9999),
    vel: new THREE.Vector2(),
  });

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setDrawRange(0, COUNT);
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uPosTex: { value: null as THREE.Texture | null },
      uVelTex: { value: null as THREE.Texture | null },
      uScale: { value: 450 },
      uSize: { value: 0.02 },
      uTime: { value: 0 },
      uDensity: { value: 1 },
      ...lampUniforms(),
    }),
    [],
  );

  useEffect(() => {
    const s = createNameSim(gl);
    sim.current = s;
    local.current.ready = false;
    local.current.born = -1;
    let alive = true;
    loadNameMask()
      .then((mask) => {
        if (alive) {
          s.bakeTargets(mask);
          local.current.ready = true;
        }
        mask.texture.dispose();
      })
      .catch((e: unknown) => {
        console.error("Name mask failed", e);
      });
    return () => {
      alive = false;
      sim.current = null;
      s.dispose();
    };
  }, [gl]);

  useFrame((state, delta) => {
    const s = sim.current;
    const m = material.current;
    if (!s || !m) {
      return;
    }
    const l = local.current;
    const T = state.clock.elapsedTime;
    if (l.born < 0 && introStarted()) {
      l.born = T;
    }

    const scale = Math.min(1, (state.viewport.width * 0.88) / NAME_W);
    points.current?.scale.setScalar(scale);

    const u = s.velVar.material.uniforms;
    u.uTime.value = T;
    const px = hero.moved ? hero.pointer.x / scale : 9999;
    const py = hero.moved ? (hero.pointer.y - NAME_Y) / scale : 9999;
    (u.uPointer.value as THREE.Vector2).set(px, py);

    // whip: stress builds only under sustained fast motion and bleeds off slowly
    let speed = 0;
    if (hero.moved && l.prev.x < 9000) {
      const idt = 1 / Math.max(delta, 1e-3);
      l.vel.set((px - l.prev.x) * idt, (py - l.prev.y) * idt);
      if (l.vel.length() > 30) {
        l.vel.setLength(30);
      }
      speed = l.vel.length();
    }
    l.prev.set(px, py);
    l.whip = THREE.MathUtils.damp(l.whip, Math.min(1, speed / 18), 4.2, delta);
    (u.uPointerVel.value as THREE.Vector2).copy(l.vel);
    u.uSpeed.value = smooth01((l.whip - 0.4) / 0.35);
    u.uAssemble.value = l.ready && l.born >= 0 ? smooth01((T - l.born - 0.75) / 1.1) : 0;

    let kick = hero.kick;
    hero.kick = 0;
    let rem = Math.min(delta, MAX_STEPS / 60);
    while (rem > 1e-4) {
      const dt = Math.min(rem, 1 / 60);
      rem -= dt;
      u.uDt.value = dt;
      u.uKick.value = kick;
      kick = 0;
      s.posVar.material.uniforms.uDt.value = dt;
      s.g.compute();
    }

    const mu = m.uniforms;
    mu.uPosTex.value = s.g.getCurrentRenderTarget(s.posVar).texture;
    mu.uVelTex.value = s.g.getCurrentRenderTarget(s.velVar).texture;
    mu.uScale.value = (state.size.height * state.viewport.dpr) / 2;
    mu.uTime.value = T;
    // the same 791,998 flakes on a smaller name: keep the gold from overexposing
    mu.uDensity.value = Math.max(scale * scale, 0.12);
    mu.uLampOn.value = hero.lampOn;
  });

  return (
    <points ref={points} geometry={geo} position={[0, NAME_Y, 0]} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vert}
        fragmentShader={frag}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
