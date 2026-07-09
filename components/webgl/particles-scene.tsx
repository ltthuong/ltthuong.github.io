"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

/* thuo.ng — an identity, written in particles.
   ~24k points rest as the name, get blown apart by the pointer like fluid,
   and periodically re-form into each facet of the craft. */

const WORDS = ["thuo.ng", "backend", "frontend", "mobile", "devops"];
const HOLD_FIRST = 6.5; // seconds resting on the name
const HOLD_REST = 2.8; // seconds on each facet
const WORLD_W = 10.5; // word width the camera comfortably frames

/* Rasterize a word and sample its filled pixels into `count` world positions. */
function sampleWord(word: string, count: number): Float32Array {
  const W = 1280;
  const H = 300;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  const family =
    'ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", sans-serif';
  let size = 220;
  ctx.font = `900 ${size}px ${family}`;
  const measured = ctx.measureText(word).width;
  size = Math.min(220, Math.floor((size * W * 0.92) / Math.max(measured, 1)));
  ctx.font = `900 ${size}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(word, W / 2, H / 2);

  const img = ctx.getImageData(0, 0, W, H).data;
  const filled: number[] = [];
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2)
      if (img[(y * W + x) * 4 + 3] > 120) filled.push(x, y);

  const out = new Float32Array(count * 3);
  const S = 0.0072; // px → world units
  const n = filled.length / 2;
  for (let i = 0; i < count; i++) {
    const j = ((Math.random() * n) | 0) * 2;
    out[i * 3] = (filled[j] - W / 2) * S + (Math.random() - 0.5) * 0.012;
    out[i * 3 + 1] = (H / 2 - filled[j + 1]) * S + (Math.random() - 0.5) * 0.012;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.22;
  }
  return out;
}

const vertexShader = /* glsl */ `
  attribute float aSpeed;
  uniform float uScale;
  uniform float uSize;
  varying float vSpeed;
  void main() {
    vSpeed = aSpeed;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColA;
  uniform vec3 uColB;
  varying float vSpeed;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.1, d);
    vec3 col = mix(uColA, uColB, clamp(vSpeed, 0.0, 1.0));
    col *= 0.85 + vSpeed * 1.6; // fast particles run hot → bloom
    gl_FragColor = vec4(col, alpha * 0.85);
  }
`;

function Field({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const burst = useRef(0);

  const sim = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    // intro: a loose shell that assembles into the name
    for (let i = 0; i < count; i++) {
      const r = 5 + Math.random() * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return {
      pos,
      vel,
      speed,
      targets: [] as Float32Array[],
      idx: 0,
      hold: HOLD_FIRST,
      lastPX: 0,
      lastPY: 0,
      lastMove: -10,
      t: 0,
    };
  }, [count]);

  useEffect(() => {
    sim.targets = WORDS.map((w) => sampleWord(w, count));
  }, [sim, count]);

  const uniforms = useMemo(
    () => ({
      uScale: { value: 450 },
      uSize: { value: 0.05 },
      uColA: { value: new THREE.Color("#5a68e8") },
      uColB: { value: new THREE.Color("#f2e9ff") },
    }),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const { pos, vel, speed } = sim;
    sim.t += dt;

    // word cycle
    if (sim.targets.length) {
      sim.hold -= dt;
      if (sim.hold <= 0) {
        sim.idx = (sim.idx + 1) % sim.targets.length;
        sim.hold = sim.idx === 0 ? HOLD_FIRST : HOLD_REST;
      }
    }
    const tgt = sim.targets[sim.idx];

    // responsive fit + pointer in field space
    const s = Math.min(1, state.viewport.width / WORLD_W);
    points.current?.scale.setScalar(s);
    let mx = (state.pointer.x * state.viewport.width) / 2 / s;
    let my = (state.pointer.y * state.viewport.height) / 2 / s;
    if (mx !== sim.lastPX || my !== sim.lastPY) sim.lastMove = sim.t;
    sim.lastPX = mx;
    sim.lastPY = my;
    if (sim.t - sim.lastMove > 3) {
      // idle / touch devices: a phantom pointer keeps the field alive
      mx = Math.sin(sim.t * 0.55) * 3.1;
      my = Math.cos(sim.t * 0.83) * 1.15;
    }

    const damp = Math.exp(-5.0 * dt);
    const spring = 3.1 * dt;
    const R = 1.35;
    const R2 = R * R;
    const T = sim.t;
    const kick = burst.current;
    burst.current = 0;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const px = pos[i3];
      const py = pos[i3 + 1];
      const pz = pos[i3 + 2];

      // spring home
      if (tgt) {
        vel[i3] += (tgt[i3] - px) * spring;
        vel[i3 + 1] += (tgt[i3 + 1] - py) * spring;
        vel[i3 + 2] += (tgt[i3 + 2] - pz) * spring;
      }

      // gentle turbulence
      vel[i3] += Math.sin(py * 1.7 + T * 1.15) * 0.34 * dt;
      vel[i3 + 1] += Math.cos(px * 1.4 - T * 0.95) * 0.3 * dt;
      vel[i3 + 2] += Math.sin((px + py) * 0.8 + T * 0.7) * 0.16 * dt;

      // pointer: radial blast + tangential swirl (the fluid feel)
      const dx = px - mx;
      const dy = py - my;
      const d2 = dx * dx + dy * dy + pz * pz * 0.3;
      if (d2 < R2) {
        const d = Math.sqrt(d2) + 1e-4;
        const f = (1 - d2 / R2) * (1 - d2 / R2);
        const radial = (f * 3.4 + kick * f * 9.0) * dt * 60;
        vel[i3] += (dx / d) * radial * 0.016 + (-dy / d) * f * 1.2 * dt;
        vel[i3 + 1] += (dy / d) * radial * 0.016 + (dx / d) * f * 1.2 * dt;
        vel[i3 + 2] += (pz / d) * radial * 0.008;
      }

      vel[i3] *= damp;
      vel[i3 + 1] *= damp;
      vel[i3 + 2] *= damp;

      pos[i3] += vel[i3] * dt * 60 * 0.016;
      pos[i3 + 1] += vel[i3 + 1] * dt * 60 * 0.016;
      pos[i3 + 2] += vel[i3 + 2] * dt * 60 * 0.016;

      const sp = Math.min(
        1,
        (Math.abs(vel[i3]) + Math.abs(vel[i3 + 1]) + Math.abs(vel[i3 + 2])) * 0.85,
      );
      speed[i] += (sp - speed[i]) * Math.min(1, dt * 9);
    }

    const geo = points.current?.geometry;
    if (geo) {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aSpeed.needsUpdate = true;
    }
    if (material.current) {
      material.current.uniforms.uScale.value =
        (state.size.height * state.viewport.dpr) / 2;
    }

    // soft camera parallax
    state.camera.position.x += (state.pointer.x * 0.55 - state.camera.position.x) * 0.03;
    state.camera.position.y += (state.pointer.y * 0.35 - state.camera.position.y) * 0.03;
    state.camera.lookAt(0, 0, 0);
  });

  useEffect(() => {
    const down = () => (burst.current = 1);
    window.addEventListener("pointerdown", down);
    return () => window.removeEventListener("pointerdown", down);
  }, []);

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[sim.pos, 3]} />
        <bufferAttribute attach="attributes-aSpeed" args={[sim.speed, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function ParticlesScene({ active = true }: { active?: boolean }) {
  const count =
    typeof window !== "undefined" && window.innerWidth < 768 ? 9000 : 24000;

  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      }}
      frameloop={active ? "always" : "never"}
    >
      <color attach="background" args={["#050506"]} />
      <Field count={count} />
      <EffectComposer>
        <Bloom
          intensity={0.95}
          luminanceThreshold={0.08}
          luminanceSmoothing={0.9}
          mipmapBlur
          radius={0.75}
        />
        <Vignette offset={0.3} darkness={0.88} eskil={false} />
      </EffectComposer>
    </Canvas>
  );
}
