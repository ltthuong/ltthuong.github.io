"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* v2.lusion.co-style hero: deep violet fog, a drifting swarm of red brush
   strokes in 3D, a hot red glow. All strokes share ONE merged geometry and
   ONE draw call; motion lives in the vertex shader. */

const STROKES = 320;

/* ── merged ribbon geometry ─────────────────────────────────── */
function buildStrokes(): THREE.BufferGeometry {
  const SEG = 18;
  const verts: number[] = [];
  const pivots: number[] = [];
  const rands: number[] = [];
  const us: number[] = [];
  const vs: number[] = [];
  const index: number[] = [];

  const tmpV = new THREE.Vector3();
  const rot = new THREE.Matrix4();

  for (let s = 0; s < STROKES; s++) {
    const swarm = Math.random() < 0.62;
    // pivot: dense swarm upper-right vs loose scatter everywhere
    let px: number, py: number, pz: number;
    if (swarm) {
      const g = () =>
        (Math.random() + Math.random() + Math.random() - 1.5) * 0.9;
      px = 2.3 + g() * 2.6;
      py = 1.0 + g() * 2.0;
      pz = -2.6 + g() * 2.2;
    } else {
      px = (Math.random() - 0.5) * 14;
      py = (Math.random() - 0.5) * 8;
      pz = -5.5 + Math.random() * 7;
    }

    const L = swarm ? 1.0 + Math.random() * 2.2 : 0.5 + Math.random() * 1.2;
    const W = 0.022 + Math.random() * 0.034;
    const curve = (Math.random() - 0.5) * 1.6;
    const r0 = Math.random();
    const r1 = Math.random();
    const r2 = swarm ? 0.45 + Math.random() * 0.55 : Math.random() * 0.5;
    const r3 = Math.random();

    // random base orientation baked into local verts
    rot.makeRotationFromEuler(
      new THREE.Euler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      ),
    );

    const base = verts.length / 3;
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      const x = (u - 0.5) * L;
      const y = curve * x * x;
      // curve normal for width offset
      const tx = 1;
      const ty = 2 * curve * x;
      const inv = 1 / Math.hypot(tx, ty);
      const nx = -ty * inv;
      const ny = tx * inv;
      const taper = Math.sin(Math.PI * u) ** 0.7;
      for (const side of [-1, 1]) {
        tmpV
          .set(x + nx * W * taper * side, y + ny * W * taper * side, 0)
          .applyMatrix4(rot);
        verts.push(tmpV.x, tmpV.y, tmpV.z);
        pivots.push(px, py, pz);
        rands.push(r0, r1, r2, r3);
        us.push(u);
        vs.push(side * 0.5 + 0.5);
      }
    }
    for (let i = 0; i < SEG; i++) {
      const a = base + i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("aPivot", new THREE.Float32BufferAttribute(pivots, 3));
  geo.setAttribute("aRand", new THREE.Float32BufferAttribute(rands, 4));
  geo.setAttribute("aU", new THREE.Float32BufferAttribute(us, 1));
  geo.setAttribute("aV", new THREE.Float32BufferAttribute(vs, 1));
  geo.setIndex(index);
  return geo;
}

const strokeVert = /* glsl */ `
  attribute vec3 aPivot;
  attribute vec4 aRand;
  attribute float aU;
  attribute float aV;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform vec2 uPointerW;
  varying float vU;
  varying float vV;
  varying vec4 vRand;
  varying float vDepth;
  varying vec3 vWorld;

  void main() {
    vU = aU; vV = aV; vRand = aRand;
    vec3 p = position;
    float t = uTime;

    // slow tumble around the stroke's own pivot
    float a1 = aRand.x * 6.2831 + t * (0.06 + aRand.y * 0.14) * (aRand.z > 0.5 ? 1.0 : -1.0);
    float c1 = cos(a1), s1 = sin(a1);
    p = vec3(c1 * p.x - s1 * p.y, s1 * p.x + c1 * p.y, p.z);
    float a2 = aRand.w * 6.2831 + t * 0.075;
    float c2 = cos(a2), s2 = sin(a2);
    p = vec3(p.x, c2 * p.y - s2 * p.z, s2 * p.y + c2 * p.z);

    vec3 world = aPivot + p;
    // breathing drift
    world.y += sin(t * (0.25 + aRand.x * 0.4) + aRand.w * 9.0) * 0.09;
    world.x += cos(t * 0.2 + aRand.y * 7.0) * 0.06;
    // pointer parallax, near strokes move more
    float depthK = clamp((world.z + 6.0) / 8.0, 0.0, 1.0);
    world.xy += uPointer * (0.12 + depthK * 0.35);

    // cursor shoves nearby strokes aside (the v2 swipe feel)
    vec2 dp = world.xy - uPointerW;
    float pd2 = dot(dp, dp);
    float push = exp(-pd2 * 0.30) * (0.55 + vRand.y * 0.6);
    world.xy += (dp / (sqrt(pd2) + 0.001)) * push;
    world.z += push * 0.25;

    vWorld = world;
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const strokeFrag = /* glsl */ `
  precision highp float;
  varying float vU;
  varying float vV;
  varying vec4 vRand;
  varying float vDepth;
  varying vec3 vWorld;
  uniform vec3 uGlowPos;

  void main() {
    float endTaper = pow(sin(3.14159 * vU), 1.4);
    float edge = pow(1.0 - abs(vV * 2.0 - 1.0), 1.1);
    float fogFade = smoothstep(19.0, 7.5, vDepth) * 0.92 + 0.08;

    vec3 dim = vec3(0.5, 0.05, 0.13);
    vec3 hot = vec3(1.0, 0.13, 0.24);
    vec3 col = mix(dim, hot, vRand.z);

    // strokes near the glow catch the light
    float g = exp(-distance(vWorld, uGlowPos) * 0.5);
    col += vec3(0.95, 0.14, 0.2) * g * 0.7;

    float alpha = endTaper * edge * fogFade * (0.68 + vRand.z * 0.32);
    gl_FragColor = vec4(col, alpha);
  }
`;

/* ── violet fog backdrop ────────────────────────────────────── */
const fogFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
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

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.02;

    vec3 deep = vec3(0.05, 0.024, 0.095);
    vec3 mid  = vec3(0.105, 0.042, 0.165);
    vec3 top  = vec3(0.07, 0.032, 0.12);

    float band = smoothstep(0.0, 0.55, uv.y) * (1.0 - smoothstep(0.55, 1.0, uv.y) * 0.6);
    vec3 col = mix(deep, mid, band);
    col = mix(col, top, smoothstep(0.75, 1.0, uv.y) * 0.5);

    float n = fbm(uv * 2.6 + vec2(t, -t * 0.6));
    col += vec3(0.07, 0.03, 0.11) * (n - 0.35) * 0.8;

    // hot core, slightly right of center — compact, not a flood
    float d = distance(uv * vec2(1.6, 1.0), vec2(0.98, 0.52));
    col += vec3(0.55, 0.045, 0.12) * exp(-d * d * 26.0) * (0.8 + 0.2 * sin(uTime * 0.8));
    col += vec3(0.22, 0.015, 0.08) * exp(-d * d * 6.5) * 0.35;

    // vignette
    float v = smoothstep(1.25, 0.35, distance(uv, vec2(0.5)));
    col *= 0.55 + v * 0.45;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const fogVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function Backdrop() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { viewport } = useThree();
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((state) => {
    if (mat.current) mat.current.uniforms.uTime.value = state.clock.elapsedTime;
  });
  // plane far behind, scaled to overfill the frustum
  const dist = 10 + 8; // camera z − plane z
  const h = 2 * Math.tan((45 * Math.PI) / 360) * dist * 1.25;
  const w = h * Math.max(viewport.aspect, 1) * 1.25;
  return (
    <mesh position={[0, 0, -8]}>
      <planeGeometry args={[w, h]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={fogVert}
        fragmentShader={fogFrag}
        depthWrite={false}
      />
    </mesh>
  );
}

function Strokes() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => buildStrokes(), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
      uPointerW: { value: new THREE.Vector2(50, 50) },
      uGlowPos: { value: new THREE.Vector3(2.6, 0.4, -2.5) },
    }),
    [],
  );
  useFrame((state) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    (mat.current.uniforms.uPointer.value as THREE.Vector2).lerp(
      state.pointer,
      0.05,
    );
    (mat.current.uniforms.uPointerW.value as THREE.Vector2).lerp(
      {
        x: (state.pointer.x * state.viewport.width) / 2,
        y: (state.pointer.y * state.viewport.height) / 2,
      } as THREE.Vector2,
      0.09,
    );
  });
  return (
    <mesh geometry={geo}>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={strokeVert}
        fragmentShader={strokeFrag}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Rig() {
  useFrame((state) => {
    state.camera.position.x +=
      (state.pointer.x * 0.5 - state.camera.position.x) * 0.04;
    state.camera.position.y +=
      (state.pointer.y * 0.3 - state.camera.position.y) * 0.04;
    state.camera.lookAt(0, 0, -2);
  });
  return null;
}

export function StrokesScene({ active = true }: { active?: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      }}
      frameloop={active ? "always" : "never"}
    >
      <Backdrop />
      <Strokes />
      <Rig />
    </Canvas>
  );
}
