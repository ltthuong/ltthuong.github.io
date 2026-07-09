"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/* v2.lusion.co-style hero: plastic toy "jacks" tumbling in zero gravity
   inside a dark stage. The pointer shoves them around; they nudge each
   other and drift home. One jack is gold — "Thưởng" means reward. */

const ARM_R = 0.3;
const ARM_L = 2.1;
const BODY_R = 1.35; // collision radius before per-jack scale

interface JackDef {
  color: string;
  rough: number;
  metal: number;
  clearcoat: number;
  scale: number;
}

// ponytail: fixed cast list, tweak freely
const CAST: JackDef[] = [
  { color: "#e9e6df", rough: 0.55, metal: 0, clearcoat: 0.1, scale: 1.15 },
  { color: "#e9e6df", rough: 0.55, metal: 0, clearcoat: 0.1, scale: 0.85 },
  { color: "#e9e6df", rough: 0.5, metal: 0, clearcoat: 0.1, scale: 1.0 },
  { color: "#eceae4", rough: 0.6, metal: 0, clearcoat: 0.1, scale: 0.7 },
  { color: "#17181c", rough: 0.45, metal: 0, clearcoat: 0.3, scale: 1.1 },
  { color: "#17181c", rough: 0.45, metal: 0, clearcoat: 0.3, scale: 0.8 },
  { color: "#2038f5", rough: 0.12, metal: 0, clearcoat: 1, scale: 1.05 },
  { color: "#2038f5", rough: 0.12, metal: 0, clearcoat: 1, scale: 0.78 },
  { color: "#3550ff", rough: 0.15, metal: 0, clearcoat: 1, scale: 0.92 },
  { color: "#d9a63c", rough: 0.24, metal: 1, clearcoat: 0.6, scale: 0.95 }, // Thưởng
  { color: "#e9e6df", rough: 0.55, metal: 0, clearcoat: 0.1, scale: 0.95 },
  { color: "#17181c", rough: 0.5, metal: 0, clearcoat: 0.3, scale: 0.65 },
];

interface Body {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  quat: THREE.Quaternion;
  angVel: THREE.Vector3;
  home: THREE.Vector3;
  scale: number;
  seed: number;
}

function Jack({ def }: { def: JackDef }) {
  const capOffset = ARM_L / 2;
  const arm = (
    rot: [number, number, number],
    caps: [THREE.Vector3, THREE.Vector3],
  ) => (
    <>
      <mesh rotation={rot}>
        <cylinderGeometry args={[ARM_R, ARM_R, ARM_L, 28, 1]} />
        <meshPhysicalMaterial
          color={def.color}
          roughness={def.rough}
          metalness={def.metal}
          clearcoat={def.clearcoat}
          clearcoatRoughness={0.25}
        />
      </mesh>
      {caps.map((p, i) => (
        <mesh
          key={i}
          position={p}
          quaternion={new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            p.clone().normalize(),
          )}
        >
          <cylinderGeometry args={[ARM_R * 0.38, ARM_R * 0.38, 0.03, 20]} />
          <meshStandardMaterial color="#0a0b0e" roughness={0.7} />
        </mesh>
      ))}
    </>
  );

  return (
    <group scale={def.scale}>
      {/* three tubes through the origin + dark bore at each end */}
      {arm(
        [0, 0, 0],
        [new THREE.Vector3(0, capOffset, 0), new THREE.Vector3(0, -capOffset, 0)],
      )}
      {arm(
        [0, 0, Math.PI / 2],
        [new THREE.Vector3(capOffset, 0, 0), new THREE.Vector3(-capOffset, 0, 0)],
      )}
      {arm(
        [Math.PI / 2, 0, 0],
        [new THREE.Vector3(0, 0, capOffset), new THREE.Vector3(0, 0, -capOffset)],
      )}
      <mesh>
        <sphereGeometry args={[ARM_R * 1.18, 24, 24]} />
        <meshPhysicalMaterial
          color={def.color}
          roughness={def.rough}
          metalness={def.metal}
          clearcoat={def.clearcoat}
          clearcoatRoughness={0.25}
        />
      </mesh>
    </group>
  );
}

function Stage({ count }: { count: number }) {
  const cast = useMemo(() => CAST.slice(0, count), [count]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const { viewport } = useThree();

  const bodies = useMemo<Body[]>(() => {
    return cast.map(() => {
      const home = new THREE.Vector3(); // assigned from viewport below
      return {
        pos: new THREE.Vector3(), // dropped in once homes are known
        vel: new THREE.Vector3(0, -1.2, 0),
        quat: new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
          ),
        ),
        angVel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.9,
          (Math.random() - 0.5) * 0.9,
          (Math.random() - 0.5) * 0.9,
        ),
        home,
        scale: 1,
        seed: Math.random() * 100,
      };
    });
  }, [cast]);

  // home slots: a jittered grid fitted to the visible stage
  useMemo(() => {
    const n = bodies.length;
    const cols = viewport.aspect > 1 ? 4 : 3;
    const rows = Math.ceil(n / cols);
    const spanX = Math.max(4.5, viewport.width * 0.72);
    const spanY = Math.max(3.2, viewport.height * 0.62);
    bodies.forEach((b, i) => {
      const col = i % cols;
      const row = (i / cols) | 0;
      b.scale = cast[i].scale;
      b.home.set(
        (col / (cols - 1) - 0.5) * spanX + (Math.random() - 0.5) * 1.1,
        (rows === 1 ? 0 : (row / (rows - 1) - 0.5) * spanY) +
          (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 2.2,
      );
      // drop in from above the first time only
      if (b.pos.lengthSq() === 0) {
        b.pos
          .copy(b.home)
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 3,
              viewport.height * 0.7 + Math.random() * 2,
              0,
            ),
          );
      }
    });
  }, [bodies, cast, viewport.width, viewport.height, viewport.aspect]);

  const burst = useRef(0);
  useEffect(() => {
    const down = () => (burst.current = 1);
    window.addEventListener("pointerdown", down);
    return () => window.removeEventListener("pointerdown", down);
  }, []);

  const tmp = useMemo(
    () => ({
      d: new THREE.Vector3(),
      dq: new THREE.Quaternion(),
    }),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const t = state.clock.elapsedTime;

    // pointer on the z=0 plane, world units
    const mx = (state.pointer.x * viewport.width) / 2;
    const my = (state.pointer.y * viewport.height) / 2;
    const kick = burst.current;
    burst.current = 0;

    // soft containment box from the visible stage
    const hw = Math.max(3.5, viewport.width / 2 - 0.8);
    const hh = Math.max(2.4, viewport.height / 2 - 0.6);

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];

      // drift home + idle bobbing
      tmp.d.copy(b.home).sub(b.pos);
      b.vel.addScaledVector(tmp.d, 1.35 * dt);
      b.vel.y += Math.sin(t * 0.7 + b.seed) * 0.12 * dt;
      b.vel.x += Math.cos(t * 0.5 + b.seed * 1.7) * 0.09 * dt;

      // pointer shove (radial, stronger on click)
      const pdx = b.pos.x - mx;
      const pdy = b.pos.y - my;
      const pd2 = pdx * pdx + pdy * pdy + b.pos.z * b.pos.z * 0.35;
      const R = 3.0;
      if (pd2 < R * R) {
        const pd = Math.sqrt(pd2) + 1e-4;
        const f = (1 - pd / R) * (1 - pd / R) * (7 + kick * 34);
        b.vel.x += (pdx / pd) * f * dt;
        b.vel.y += (pdy / pd) * f * dt;
        b.vel.z += (b.pos.z / pd) * f * 0.5 * dt;
        b.angVel.x += (pdy / pd) * f * 0.35 * dt;
        b.angVel.y += (pdx / pd) * f * 0.45 * dt;
      }

      // pair repulsion — toy-on-toy nudges
      for (let j = i + 1; j < bodies.length; j++) {
        const o = bodies[j];
        tmp.d.copy(b.pos).sub(o.pos);
        const rr = BODY_R * (b.scale + o.scale) * 0.5 * 1.55;
        const d2 = tmp.d.lengthSq();
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = ((rr - d) / rr) * 4.2;
          tmp.d.multiplyScalar(1 / d);
          b.vel.addScaledVector(tmp.d, push * dt);
          o.vel.addScaledVector(tmp.d, -push * dt);
          b.angVel.x += tmp.d.y * push * 0.3 * dt;
          o.angVel.y += tmp.d.x * push * 0.3 * dt;
        }
      }

      // soft walls
      if (b.pos.x > hw) b.vel.x -= (b.pos.x - hw) * 2.4 * dt;
      if (b.pos.x < -hw) b.vel.x -= (b.pos.x + hw) * 2.4 * dt;
      if (b.pos.y > hh) b.vel.y -= (b.pos.y - hh) * 2.4 * dt;
      if (b.pos.y < -hh) b.vel.y -= (b.pos.y + hh) * 2.4 * dt;
      if (b.pos.z > 2.2) b.vel.z -= (b.pos.z - 2.2) * 2.4 * dt;
      if (b.pos.z < -2.2) b.vel.z -= (b.pos.z + 2.2) * 2.4 * dt;

      // integrate
      const damp = Math.exp(-0.9 * dt);
      b.vel.multiplyScalar(damp);
      b.angVel.multiplyScalar(Math.exp(-0.35 * dt));
      b.pos.addScaledVector(b.vel, dt);

      tmp.dq.set(
        b.angVel.x * dt * 0.5,
        b.angVel.y * dt * 0.5,
        b.angVel.z * dt * 0.5,
        0,
      );
      tmp.dq.multiply(b.quat);
      b.quat.x += tmp.dq.x;
      b.quat.y += tmp.dq.y;
      b.quat.z += tmp.dq.z;
      b.quat.w += tmp.dq.w;
      b.quat.normalize();

      const g = groups.current[i];
      if (g) {
        g.position.copy(b.pos);
        g.quaternion.copy(b.quat);
      }
    }

    // lazy camera parallax
    state.camera.position.x += (state.pointer.x * 0.6 - state.camera.position.x) * 0.04;
    state.camera.position.y += (state.pointer.y * 0.4 - state.camera.position.y) * 0.04;
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      {cast.map((def, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el;
          }}
        >
          <Jack def={def} />
        </group>
      ))}
    </>
  );
}

export function JacksScene({ active = true }: { active?: boolean }) {
  const count =
    typeof window !== "undefined" && window.innerWidth < 768 ? 8 : CAST.length;

  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 40 }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      }}
      frameloop={active ? "always" : "never"}
      onCreated={({ gl, scene }) => {
        const pmrem = new THREE.PMREMGenerator(gl);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 0.85;
      }}
    >
      <color attach="background" args={["#0b0d12"]} />
      <fog attach="fog" args={["#0b0d12", 14, 26]} />
      <directionalLight position={[6, 8, 6]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[-7, -3, 4]} intensity={0.25} color="#8090ff" />
      <Stage count={count} />
    </Canvas>
  );
}
