"use client";

import { useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { Backdrop } from "./backdrop";
import { Silk } from "./silk";
import { NameParticles } from "./name-particles";
import { HeroPost } from "./hero-post";
import { hero, resetHero } from "./hero-store";

/* Hero scene: wet lacquer backdrop, son silk blown through the room, the name in
   791,998 gold-leaf particles, all lit by a lamp that follows the cursor. */

const LAMP_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const hit = new THREE.Vector3();
const LAMP_K = 110;
const LAMP_DAMP = 14;
// before the first move the lamp rests up and to the right of the name, half lit
const LAMP_REST = new THREE.Vector2(0.42, 0.52);
const LAMP_REST_ON = 0.6;

function Rig() {
  useFrame((state, delta) => {
    const cam = state.camera;
    cam.position.x = THREE.MathUtils.damp(cam.position.x, state.pointer.x * 0.5, 2.4, delta);
    cam.position.y = THREE.MathUtils.damp(cam.position.y, state.pointer.y * 0.3, 2.4, delta);
    cam.lookAt(0, 0, -2);
    hero.now = state.clock.elapsedTime;

    state.raycaster.setFromCamera(hero.moved ? state.pointer : LAMP_REST, cam);
    if (state.raycaster.ray.intersectPlane(LAMP_PLANE, hit)) {
      hero.pointer.copy(hit);
    }
    if (hero.pendingBurst) {
      hero.pendingBurst = false;
      hero.burstT = hero.now;
      hero.burstX = hero.pointer.x;
      hero.burstY = hero.pointer.y;
      hero.kick = 1;
    }

    // the lamp hangs on a soft spring: it swings a little past the cursor
    const dt = Math.min(delta, 1 / 30);
    const vel = hero.lampVel;
    vel.x += (hero.pointer.x - hero.lamp.x) * LAMP_K * dt;
    vel.y += (hero.pointer.y - hero.lamp.y) * LAMP_K * dt;
    vel.multiplyScalar(Math.exp(-LAMP_DAMP * dt));
    hero.lamp.x += vel.x * dt;
    hero.lamp.y += vel.y * dt;
    hero.lampOn = THREE.MathUtils.damp(hero.lampOn, hero.moved ? 1 : LAMP_REST_ON, 2.5, delta);
  });
  return null;
}

function isInteractive(target: EventTarget | null) {
  return target instanceof Element ? target.closest("a, button") !== null : false;
}

export function StrokesScene({
  active = true,
  fallback,
}: {
  active?: boolean;
  fallback: React.ReactNode;
}) {
  const [coarse] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [dpr, setDpr] = useState(coarse ? 1 : 1.5);
  const [lost, setLost] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    resetHero();
    const down = (e: PointerEvent) => {
      if (isInteractive(e.target)) {
        return;
      }
      hero.moved = true;
      hero.pendingBurst = true;
    };
    const move = () => {
      hero.moved = true;
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { once: true });
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
    };
  }, []);

  useEffect(() => {
    if (!lost) {
      return;
    }
    const retry = setTimeout(() => {
      setLost(false);
      setGeneration((g) => g + 1);
    }, 1500);
    return () => clearTimeout(retry);
  }, [lost]);

  if (lost) {
    return fallback;
  }

  return (
    <Canvas
      key={generation}
      camera={{ position: [0, 0, 10], fov: 45 }}
      dpr={dpr}
      gl={{
        antialias: false,
        stencil: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      }}
      frameloop={active ? "always" : "never"}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          console.warn("WebGL context lost, showing the static hero");
          setLost(true);
        });
      }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} />
      <Backdrop />
      <Silk count={coarse ? 44 : 90} />
      <NameParticles />
      <Rig />
      <HeroPost />
    </Canvas>
  );
}
