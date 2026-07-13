"use client";

import { useEffect, useMemo, useRef } from "react";
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
  uniform vec2 uPointerVel;
  uniform float uBurstT;
  uniform vec2 uBurstPos;
  varying float vU;
  varying float vV;
  varying vec4 vRand;
  varying float vDepth;
  varying vec3 vWorld;
  varying float vHeat;

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

    // cursor: radial shove + velocity brushing + click shockwave
    vec2 dp = world.xy - uPointerW;
    float pd = length(dp) + 0.001;
    float prox = exp(-pd * pd * 0.30);
    float push = prox * (0.55 + vRand.y * 0.6);
    world.xy += (dp / pd) * push;
    world.z += push * 0.25;

    // fast swipes drag strokes along with the hand
    world.xy += uPointerVel * prox * (0.9 + vRand.x * 0.9);

    // expanding ring impulse from the last click
    float bt = uTime - uBurstT;
    vec2 bp = world.xy - uBurstPos;
    float bd = length(bp) + 0.001;
    float ring = bt * 7.5;
    float wave = exp(-pow(bd - ring, 2.0) * 2.0) * exp(-bt * 2.4) * step(0.0, bt);
    world.xy += (bp / bd) * wave * (1.3 + vRand.y * 0.9);
    world.z += wave * 0.5;

    vHeat = clamp(push * 1.1 + wave * 1.5 + length(uPointerVel) * prox * 1.3, 0.0, 1.0);

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
  varying float vHeat;
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

    // disturbed strokes run white-hot
    col = mix(col, vec3(1.0, 0.52, 0.45), vHeat * 0.7);

    float alpha = endTaper * edge * fogFade * (0.68 + vRand.z * 0.32);
    alpha *= 1.0 + vHeat * 0.6;
    gl_FragColor = vec4(col, alpha);
  }
`;

/* ── violet fog backdrop ────────────────────────────────────── */
const fogFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uBurstT;

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

    // click flash — the whole room breathes red for a beat
    float bt = uTime - uBurstT;
    col += vec3(0.30, 0.03, 0.09) * exp(-bt * 3.2) * step(0.0, bt);

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

function Backdrop({ burst }: { burst: React.MutableRefObject<BurstRef> }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { viewport } = useThree();
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uBurstT: { value: -100 } }),
    [],
  );
  useFrame((state) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    mat.current.uniforms.uBurstT.value = burst.current.t;
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

interface BurstRef {
  t: number; // burst start, in scene clock seconds
  now: number; // latest scene clock, kept fresh each frame
  x: number; // live pointer (world)
  y: number;
  bx: number; // frozen click position (world)
  by: number;
}

function Strokes({ burst }: { burst: React.MutableRefObject<BurstRef> }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => buildStrokes(), []);
  const prevPW = useRef(new THREE.Vector2(50, 50));
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
      uPointerW: { value: new THREE.Vector2(50, 50) },
      uPointerVel: { value: new THREE.Vector2() },
      uBurstT: { value: -100 },
      uBurstPos: { value: new THREE.Vector2() },
      uGlowPos: { value: new THREE.Vector3(2.6, 0.4, -2.5) },
    }),
    [],
  );
  useFrame((state, delta) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    (u.uPointer.value as THREE.Vector2).lerp(state.pointer, 0.05);

    const pw = u.uPointerW.value as THREE.Vector2;
    prevPW.current.copy(pw);
    pw.lerp(
      {
        x: (state.pointer.x * state.viewport.width) / 2,
        y: (state.pointer.y * state.viewport.height) / 2,
      } as THREE.Vector2,
      0.12,
    );
    // swipe velocity (world units/s), smoothed + capped
    const vel = u.uPointerVel.value as THREE.Vector2;
    const dt = Math.max(delta, 1e-3);
    vel.lerp(
      { x: (pw.x - prevPW.current.x) / dt, y: (pw.y - prevPW.current.y) / dt } as THREE.Vector2,
      0.18,
    );
    if (vel.length() > 2.6) vel.setLength(2.6);

    // burst bookkeeping: expose clock + pointer to the DOM listener, read back its clicks
    burst.current.now = state.clock.elapsedTime;
    burst.current.x = pw.x;
    burst.current.y = pw.y;
    u.uBurstT.value = burst.current.t;
    (u.uBurstPos.value as THREE.Vector2).set(burst.current.bx, burst.current.by);
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

/* ── THƯỞNG, written in ~22k particles ──────────────────────── */
/* Glyph shapes come from rasterizing the real Fraunces webfont on a 2D
   canvas, so Vietnamese diacritics are pixel-perfect. Particles spring
   home, the pointer blows them aside, clicks blast them apart. */

const NAME_TEXT = "THƯỞNG";
const NAME_W = 11; // world units the name spans when fully fit

function sampleName(count: number): Float32Array {
  const W = 1400;
  const H = 460;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  const family = `Fraunces, Georgia, "Times New Roman", serif`;
  let size = 250;
  ctx.font = `600 ${size}px ${family}`;
  const measured = ctx.measureText(NAME_TEXT).width;
  size = Math.min(250, Math.floor((size * W * 0.94) / Math.max(measured, 1)));
  ctx.font = `600 ${size}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(NAME_TEXT, W / 2, H / 2 + size * 0.1); // nudge for diacritic headroom

  const img = ctx.getImageData(0, 0, W, H).data;
  const filled: number[] = [];
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2)
      if (img[(y * W + x) * 4 + 3] > 120) filled.push(x, y);

  const out = new Float32Array(count * 3);
  const S = NAME_W / W;
  const n = filled.length / 2;
  for (let i = 0; i < count; i++) {
    const j = ((Math.random() * n) | 0) * 2;
    out[i * 3] = (filled[j] - W / 2) * S + (Math.random() - 0.5) * 0.012;
    out[i * 3 + 1] = (H / 2 - filled[j + 1]) * S + (Math.random() - 0.5) * 0.012;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }
  return out;
}

const nameVert = /* glsl */ `
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

const nameFrag = /* glsl */ `
  uniform vec3 uColA;
  uniform vec3 uColB;
  varying float vSpeed;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.12, d);
    vec3 col = mix(uColA, uColB, clamp(vSpeed, 0.0, 1.0));
    col *= 0.9 + vSpeed * 1.5; // fast particles run hot
    gl_FragColor = vec4(col, alpha * 0.9);
  }
`;

function NameParticles() {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const burst = useRef(0);
  const moved = useRef(false); // no repel hole until the pointer really moves
  const { viewport } = useThree();

  const count =
    typeof window !== "undefined" && window.innerWidth < 768 ? 9000 : 22000;

  const sim = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    // intro: a loose shell that condenses into the name
    for (let i = 0; i < count; i++) {
      const r = 5.5 + Math.random() * 3.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi) * 0.5;
    }
    return { pos, vel, speed, targets: null as Float32Array | null };
  }, [count]);

  useEffect(() => {
    let alive = true;
    document.fonts
      .load("600 250px Fraunces")
      .catch(() => undefined)
      .then(() => {
        if (alive) sim.targets = sampleName(count);
      });
    const down = () => (burst.current = 1);
    const firstMove = () => (moved.current = true);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", firstMove, { once: true });
    return () => {
      alive = false;
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", firstMove);
    };
  }, [sim, count]);

  const uniforms = useMemo(
    () => ({
      uScale: { value: 450 },
      uSize: { value: 0.055 },
      uColA: { value: new THREE.Color("#c4677f") },
      uColB: { value: new THREE.Color("#fff3ea") },
    }),
    [],
  );

  useFrame((state, delta) => {
    const { pos, vel, speed, targets } = sim;
    const T = state.clock.elapsedTime;

    // fit the name to the visible stage
    const s = Math.min(1, (state.viewport.width * 0.88) / NAME_W);
    points.current?.scale.setScalar(s);
    const mx = moved.current
      ? (state.pointer.x * state.viewport.width) / 2 / s
      : 9999;
    const my = moved.current
      ? (state.pointer.y * state.viewport.height) / 2 / s
      : 9999;

    const R = 1.5;
    const R2 = R * R;
    let kick = burst.current;
    burst.current = 0;

    // substep so the sim is framerate-independent: throttled tabs and
    // low-end devices integrate the same trajectory, just chunked
    let rem = Math.min(delta, 0.5);
    while (rem > 1e-4) {
      const dt = Math.min(rem, 1 / 60);
      rem -= dt;
      const damp = Math.exp(-4.6 * dt);
      const spring = 3.4 * dt;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const px = pos[i3];
        const py = pos[i3 + 1];
        const pz = pos[i3 + 2];

        if (targets) {
          vel[i3] += (targets[i3] - px) * spring;
          vel[i3 + 1] += (targets[i3 + 1] - py) * spring;
          vel[i3 + 2] += (targets[i3 + 2] - pz) * spring;
        }

        // gentle breath
        vel[i3] += Math.sin(py * 1.9 + T * 1.1) * 0.22 * dt;
        vel[i3 + 1] += Math.cos(px * 1.5 - T * 0.9) * 0.2 * dt;

        // pointer: radial blast + swirl
        const dx = px - mx;
        const dy = py - my;
        const d2 = dx * dx + dy * dy + pz * pz * 0.3;
        if (d2 < R2) {
          const d = Math.sqrt(d2) + 1e-4;
          const f = (1 - d2 / R2) * (1 - d2 / R2);
          const radial = (f * 3.6 + kick * f * 10.0) * dt * 60 * 0.016;
          vel[i3] += (dx / d) * radial + (-dy / d) * f * 1.1 * dt;
          vel[i3 + 1] += (dy / d) * radial + (dx / d) * f * 1.1 * dt;
          vel[i3 + 2] += (pz / d) * radial * 0.5;
        }

        vel[i3] *= damp;
        vel[i3 + 1] *= damp;
        vel[i3 + 2] *= damp;

        pos[i3] += vel[i3] * dt * 0.96;
        pos[i3 + 1] += vel[i3 + 1] * dt * 0.96;
        pos[i3 + 2] += vel[i3 + 2] * dt * 0.96;

        const sp = Math.min(
          1,
          (Math.abs(vel[i3]) + Math.abs(vel[i3 + 1])) * 0.5,
        );
        speed[i] += (sp - speed[i]) * Math.min(1, dt * 8);
      }
      kick = 0; // the click impulse fires on the first substep only
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
  });

  return (
    <points ref={points} position={[0, 0.2, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[sim.pos, 3]} />
        <bufferAttribute attach="attributes-aSpeed" args={[sim.speed, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={nameVert}
        fragmentShader={nameFrag}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function StrokesScene({ active = true }: { active?: boolean }) {
  const burst = useRef<BurstRef>({ t: -100, now: 0, x: 0, y: 0, bx: 0, by: 0 });

  useEffect(() => {
    const down = () => {
      const b = burst.current;
      b.t = b.now;
      b.bx = b.x;
      b.by = b.y;
    };
    window.addEventListener("pointerdown", down);
    return () => window.removeEventListener("pointerdown", down);
  }, []);

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
      <Backdrop burst={burst} />
      <Strokes burst={burst} />
      <NameParticles />
      <Rig />
    </Canvas>
  );
}
