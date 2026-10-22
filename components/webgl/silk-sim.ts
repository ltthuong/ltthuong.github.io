import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { HASH_GLSL } from "./name-sim";
import { hero } from "./hero-store";

/* Silk ribbons blown across the room, simulated on the GPU. One texel per
   (node, ribbon): the head steers through a drifting eddy field, every other
   node trails the one ahead of it at a fixed distance, and a side vector
   carries each twist slowly down the silk. */

export const NODES = 48;

/* Where a point lands on the name's plane, seen from the camera, in units of
   the name's half size: under 1 means it sits behind the letters. */
export const NAME_SPACE_GLSL = /* glsl */ `
  uniform vec4 uName;
  vec2 nameSpace(vec3 p) {
    return (p.xy * (10.0 / (10.0 - p.z)) - uName.xy) / uName.zw;
  }
`;

/* Per-ribbon traits come from a hash of the row, so the sim and the ribbon
   shader agree without any upload. */
export const SILK_GLSL = /* glsl */ `
  ${HASH_GLSL}
  const int NODES = ${NODES};
  float trait(int j, uint k) {
    return float(pcg(uint(j) * 2654435761u + k * 40503u + 1u)) * (1.0 / 4294967296.0);
  }
  float ribbonWidth(int j) {
    return mix(0.06, 0.32, pow(trait(j, 1u), 1.6));
  }
`;

const COMMON = /* glsl */ `
  uniform float uDt;
  uniform float uTime;
  uniform float uNow;
  uniform vec2 uWind;
  uniform float uAspect;
  uniform vec3 uLamp;
  uniform float uLampOn;
  uniform vec2 uLampVel;
  uniform float uBurstT;
  uniform vec2 uBurst;
  ${SILK_GLSL}

  const float SPEED = 0.9;
  const float NEAR_Z = -1.0;
  const float FAR_Z = -7.5;

  float segLen(int j) {
    return mix(0.18, 0.34, trait(j, 2u));
  }

  // how far upstream a ribbon starts so it is born off screen at depth z
  float reach(float z) {
    float hh = (10.0 - z) * 0.4142;
    return length(vec2(hh * uAspect, hh)) + 1.5;
  }

  vec3 emitter(int j, float gen) {
    uint s = pcg(uint(j) * 9781u + uint(gen) * 6271u + 3u);
    float z = mix(FAR_Z, NEAR_Z, pow(rnd(s), 0.8));
    float r = reach(z);
    vec2 across = vec2(-uWind.y, uWind.x) * (rnd(s) * 2.0 - 1.0) * r * 0.9;
    return vec3(-uWind * r + across, z);
  }

  float lifespan(int j, float gen) {
    uint s = pcg(uint(j) * 7417u + uint(gen) * 3301u + 5u);
    float len = segLen(j) * float(NODES - 1);
    return (2.0 * reach(-4.0) + len) / SPEED * mix(0.75, 1.1, rnd(s));
  }

  // curl of a few drifting waves: eddies that never pile the silk into a sink
  vec2 eddies(vec3 p, float t) {
    vec2 v = vec2(0.0);
    vec3 k = vec3(0.23, 0.17, 0.12);
    v += vec2(k.y, -k.x) * cos(dot(k, p) + t * 0.21) * 2.0;
    k = vec3(-0.31, 0.19, -0.1);
    v += vec2(k.y, -k.x) * cos(dot(k, p) - t * 0.17 + 1.3) * 1.5;
    k = vec3(0.12, -0.41, 0.15);
    v += vec2(k.y, -k.x) * cos(dot(k, p) + t * 0.26 + 4.1) * 1.1;
    k = vec3(0.52, 0.47, -0.2);
    v += vec2(k.y, -k.x) * cos(dot(k, p) - t * 0.33 + 2.2) * 0.55;
    return v;
  }

  float lampNear(vec3 p) {
    vec2 d = p.xy - uLamp.xy;
    float depth = clamp((p.z - FAR_Z) / (NEAR_Z - FAR_Z), 0.0, 1.0);
    return exp(-dot(d, d) * 0.3) * uLampOn * mix(0.45, 1.0, depth);
  }
`;

const VEL = /* glsl */ `
  ${COMMON}
  void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    vec4 vel = texelFetch(textureVel, c, 0);
    if (c.x > 0) {
      gl_FragColor = vel;
      return;
    }
    vec4 pos = texelFetch(texturePos, c, 0);
    if (pos.w <= 0.0) {
      gl_FragColor = vec4(uWind * SPEED, 0.0, vel.w + 1.0);
      return;
    }
    vec3 p = pos.xyz;
    vec3 want = vec3(uWind * SPEED + eddies(p, uTime), 0.0);
    want.z = (clamp(p.z, FAR_Z, NEAR_Z) - p.z) * 0.6 + sin(p.x * 0.3 + uTime * 0.2 + float(c.y)) * 0.15;
    vec3 v = vel.xyz + (want - vel.xyz) * (1.0 - exp(-uDt / 1.6));
    // the lamp draws the silk into a slow eddy around it
    vec2 d = p.xy - uLamp.xy;
    v.xy += (vec2(-d.y, d.x) * 1.2 + d * 0.8) / (length(d) + 0.4) * lampNear(p) * 5.0 * uDt;
    gl_FragColor = vec4(v, vel.w);
  }
`;

const POS = /* glsl */ `
  ${COMMON}
  void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    int j = c.y;
    vec4 pos = texelFetch(texturePos, c, 0);
    vec4 head = texelFetch(texturePos, ivec2(0, j), 0);
    vec3 wind = vec3(uWind, 0.0);

    if (c.x == 0) {
      vec4 vel = texelFetch(textureVel, c, 0);
      gl_FragColor = pos.w <= 0.0
        ? vec4(emitter(j, vel.w + 1.0), 1.0)
        : vec4(pos.xyz + vel.xyz * uDt, pos.w - uDt / lifespan(j, vel.w));
      return;
    }

    float seg = segLen(j);
    if (head.w > pos.w + 0.5) {
      // the head was just reborn upstream: lay the ribbon out behind it
      gl_FragColor = vec4(head.xyz - wind * seg * float(c.x), head.w);
      return;
    }

    vec3 lead = texelFetch(texturePos, ivec2(c.x - 1, j), 0).xyz;
    vec3 p = pos.xyz;
    p -= wind * 0.15 * uDt;
    p.y -= 0.06 * uDt;
    p.xy += eddies(p * 1.9, uTime * 1.6) * 0.08 * uDt;

    vec2 d = p.xy - uLamp.xy;
    float near = lampNear(p);
    p.xy += d / (length(d) + 0.2) * near * 2.4 * uDt + uLampVel * near * 0.5 * uDt;

    // ring from the last click: displacement only, never brightness
    float bt = uNow - uBurstT;
    vec2 bp = p.xy - uBurst;
    float bd = length(bp) + 1e-3;
    p.xy += bp / bd * exp(-pow(bd - bt * 7.5, 2.0) * 2.0) * exp(-bt * 2.4) * step(0.0, bt) * 4.0 * uDt;

    vec3 dl = p - lead;
    float len = length(dl);
    p = lead + (len > 1e-4 ? dl / len : -wind) * seg;
    gl_FragColor = vec4(p, head.w);
  }
`;

const SIDE = /* glsl */ `
  ${COMMON}
  void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    int j = c.y;
    vec3 s = texelFetch(textureSide, c, 0).xyz;
    vec3 p = texelFetch(texturePos, c, 0).xyz;
    vec3 q = texelFetch(texturePos, ivec2(c.x == 0 ? 1 : c.x - 1, j), 0).xyz;
    vec3 T = normalize((c.x == 0 ? p - q : q - p) + 1e-6);
    vec3 level = cross(T, vec3(0.0, 0.0, 1.0));
    level = dot(level, level) > 1e-6 ? normalize(level) : vec3(1.0, 0.0, 0.0);

    vec3 want;
    if (c.x == 0) {
      // the head turns the ribbon; the twist then travels down the silk
      float a = sin(uTime * mix(0.3, 0.8, trait(j, 4u)) + trait(j, 5u) * 6.2832) * mix(0.6, 2.2, trait(j, 6u));
      want = level * cos(a) + cross(T, level) * sin(a);
    } else {
      want = texelFetch(textureSide, ivec2(c.x - 1, j), 0).xyz;
    }
    if (dot(s, s) < 0.5) {
      s = want;
    }
    if (dot(want, s) < 0.0) {
      want = -want;
    }
    s = mix(s, want, 1.0 - exp(-uDt * (c.x == 0 ? 5.0 : 7.5)));
    s -= T * dot(s, T);
    gl_FragColor = vec4(dot(s, s) > 1e-6 ? normalize(s) : level, 1.0);
  }
`;

const SEED = /* glsl */ `
  uniform float uMode;
  ${COMMON}
  void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    int j = c.y;
    vec3 wind = vec3(uWind, 0.0);
    uint s = pcg(uint(j) * 4099u + 11u);
    float life = 0.05 + 0.95 * rnd(s);
    vec3 head = emitter(j, 0.0) + wind * SPEED * (1.0 - life) * lifespan(j, 0.0);
    if (uMode < 0.5) {
      gl_FragColor = vec4(head - wind * segLen(j) * float(c.x), life);
    } else if (uMode < 1.5) {
      gl_FragColor = vec4(wind * SPEED, 0.0);
    } else {
      gl_FragColor = vec4(normalize(cross(wind, vec3(0.0, 0.0, 1.0))), 1.0);
    }
  }
`;

export type SilkSim = ReturnType<typeof createSilkSim>;

export function createSilkSim(gl: THREE.WebGLRenderer, count: number) {
  const g = new GPUComputationRenderer(NODES, count, gl);
  if (!gl.extensions.has("EXT_color_buffer_float")) {
    g.setDataType(THREE.HalfFloatType);
  }
  const blank = g.createTexture();
  const velVar = g.addVariable("textureVel", VEL, blank);
  const posVar = g.addVariable("texturePos", POS, blank);
  const sideVar = g.addVariable("textureSide", SIDE, blank);
  g.setVariableDependencies(velVar, [posVar, velVar]);
  g.setVariableDependencies(posVar, [posVar, velVar]);
  g.setVariableDependencies(sideVar, [posVar, sideVar]);

  // one set of uniform objects shared by every pass
  const u = {
    uDt: { value: 1 / 60 },
    uTime: { value: 0 },
    uNow: { value: 0 },
    uWind: { value: new THREE.Vector2(1, 0) },
    uAspect: { value: 1.6 },
    uLamp: { value: hero.lamp },
    uLampOn: { value: 0 },
    uLampVel: { value: new THREE.Vector2() },
    uBurstT: { value: -100 },
    uBurst: { value: new THREE.Vector2() },
  };
  for (const v of [velVar, posVar, sideVar]) {
    Object.assign(v.material.uniforms, u);
  }

  const err = g.init();
  if (err) {
    g.dispose();
    blank.dispose();
    throw new Error(`Silk GPGPU init failed: ${err}`);
  }
  blank.dispose();

  const step = (dt: number) => {
    u.uDt.value = dt;
    u.uTime.value += dt;
    g.compute();
  };

  return {
    u,
    step,
    /* Lay every ribbon somewhere along its life, then let the eddies curl it,
       so the first frame already shows a room full of silk. */
    seed(steps: number) {
      const mat = g.createShaderMaterial(SEED, { ...u, uMode: { value: 0 } });
      const vars = [posVar, velVar, sideVar];
      vars.forEach((v, mode) => {
        mat.uniforms.uMode.value = mode;
        for (const rt of v.renderTargets) {
          g.doRenderTarget(mat, rt);
        }
      });
      mat.dispose();
      for (let i = 0; i < steps; i++) {
        step(1 / 30);
      }
    },
    pos: () => g.getCurrentRenderTarget(posVar).texture,
    side: () => g.getCurrentRenderTarget(sideVar).texture,
    dispose: () => g.dispose(),
  };
}
