import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";

/* THƯỞNG in 791,998 particles (07/9/1998), simulated entirely on the GPU.
   Seeding is GPU too: the big-bang nucleus and the glyph targets are each one
   fragment pass, so the main thread never loops over the particles. */

export const NAME_TEXT = "THƯỞNG";
export const NAME_W = 11;
export const NAME_Y = 0.2;
export const COUNT = 791998;
export const TEX = 890;

const MASK_W = 1400;
const MASK_H = 460;

export const HASH_GLSL = /* glsl */ `
  uint pcg(uint v) {
    uint s = v * 747796405u + 2891336453u;
    uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
    return (w >> 22u) ^ w;
  }
  float rnd(inout uint s) {
    s = pcg(s);
    return float(s) * (1.0 / 4294967296.0);
  }
`;

const SEED_GLSL = /* glsl */ `
  ${HASH_GLSL}
  uint texelSeed(uint salt) {
    uvec2 c = uvec2(gl_FragCoord.xy);
    return pcg(c.y * uint(resolution.x) + c.x + salt * 2654435769u);
  }
`;

const BIG_BANG = /* glsl */ `
  uniform float uMode;
  ${SEED_GLSL}
  void main() {
    uint s = texelSeed(1u);
    float th = rnd(s) * 6.2831853;
    float cz = rnd(s) * 2.0 - 1.0;
    float sz = sqrt(1.0 - cz * cz);
    vec3 dir = vec3(sz * cos(th), sz * sin(th), cz);
    float r = rnd(s) * 0.12;
    float sp = 4.5 + rnd(s) * 9.5;
    gl_FragColor = uMode < 0.5
      ? vec4(dir.xy * r, dir.z * r * 0.6, 1.0)
      : vec4(dir.xy * sp, dir.z * sp * 0.55, 1.0);
  }
`;

const TARGETS = /* glsl */ `
  uniform sampler2D uMask;
  uniform vec4 uBox;
  uniform vec2 uWorld;
  ${SEED_GLSL}
  void main() {
    uint s = texelSeed(2u);
    vec2 p = vec2(0.5);
    for (int i = 0; i < 40; i++) {
      p = mix(uBox.xy, uBox.zw, vec2(rnd(s), rnd(s)));
      if (textureLod(uMask, p, 0.0).a > 0.47) {
        break;
      }
    }
    vec2 w = (p - 0.5) * uWorld + (vec2(rnd(s), rnd(s)) - 0.5) * 0.01;
    gl_FragColor = vec4(w, (rnd(s) - 0.5) * 0.3, 1.0);
  }
`;

const VEL_SIM = /* glsl */ `
  uniform float uDt;
  uniform float uTime;
  uniform float uAssemble;
  uniform float uKick;
  uniform vec2 uPointer;
  uniform vec2 uPointerVel;
  uniform float uSpeed;
  uniform sampler2D textureTargets;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 pos = texture2D(texturePosition, uv).xyz;
    vec3 vel = texture2D(textureVelocity, uv).xyz;
    vec3 tgt = texture2D(textureTargets, uv).xyz;

    vel += (tgt - pos) * 3.6 * uDt * uAssemble;
    vel.x += sin(pos.y * 1.9 + uTime * 1.1) * 0.22 * uDt;
    vel.y += cos(pos.x * 1.5 - uTime * 0.9) * 0.2 * uDt;

    vec2 dp = pos.xy - uPointer;
    float d2 = dot(dp, dp) + pos.z * pos.z * 0.3;
    float R2 = 2.25;
    if (d2 < R2) {
      float d = sqrt(d2) + 1e-4;
      float f = 1.0 - d2 / R2;
      f *= f;
      float radial = (f * 3.6 + uKick * f * 10.0) * uDt;
      vel.xy += (dp / d) * radial + vec2(-dp.y, dp.x) / d * f * 1.1 * uDt;
      vel.z += (pos.z / d) * radial * 0.5;
      vel.xy += uPointerVel * f * uSpeed * 2.2 * uDt;
    }

    // whip: shaking hard makes every shard thrash on its own phase, then the
    // springs heal the name
    if (uSpeed > 0.001) {
      float r1 = fract(sin(dot(uv, vec2(127.1, 311.7))) * 43758.5453);
      float r2 = fract(sin(dot(uv, vec2(269.5, 183.3))) * 43758.5453);
      float ph = r1 * 6.2831;
      float n = sin(pos.y * 6.1 + uTime * (22.0 + r2 * 46.0) + ph)
              * cos(pos.x * 4.7 - uTime * (17.0 + r1 * 40.0) + ph * 1.7);
      vec2 shear = vec2(-uPointerVel.y, uPointerVel.x);
      vec2 sdir = shear / (length(shear) + 1e-3);
      vec2 dir = normalize(sdir + vec2(cos(ph), sin(ph)) * 1.6);
      float amp = uSpeed * (0.4 + r1 * 1.3) * (length(uPointerVel) + 3.0) * 2.0;
      vel.xy += dir * n * amp * uDt;
      vel.xy += vec2(cos(ph), sin(ph)) * (r2 - 0.4) * uSpeed * 6.0 * uDt;
      vel.z += (n + r2 - 0.5) * uSpeed * 6.0 * uDt;
    }

    float damp = mix(4.6, 1.9, clamp(uSpeed, 0.0, 1.0));
    vel *= exp(-damp * uDt);
    gl_FragColor = vec4(vel, 1.0);
  }
`;

const POS_SIM = /* glsl */ `
  uniform float uDt;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 pos = texture2D(texturePosition, uv).xyz;
    vec3 vel = texture2D(textureVelocity, uv).xyz;
    gl_FragColor = vec4(pos + vel * uDt * 0.96, 1.0);
  }
`;

export interface NameMask {
  texture: THREE.CanvasTexture;
  box: THREE.Vector4;
}

export type NameSim = ReturnType<typeof createNameSim>;

export function createNameSim(gl: THREE.WebGLRenderer) {
  const g = new GPUComputationRenderer(TEX, TEX, gl);
  if (!gl.extensions.has("EXT_color_buffer_float")) {
    g.setDataType(THREE.HalfFloatType);
  }
  const seed = new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType);
  seed.needsUpdate = true;

  const velVar = g.addVariable("textureVelocity", VEL_SIM, seed);
  const posVar = g.addVariable("texturePosition", POS_SIM, seed);
  g.setVariableDependencies(velVar, [posVar, velVar]);
  g.setVariableDependencies(posVar, [posVar, velVar]);
  const targets = g.createRenderTarget(
    TEX,
    TEX,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.NearestFilter,
    THREE.NearestFilter,
  );
  Object.assign(velVar.material.uniforms, {
    uDt: { value: 0 },
    uTime: { value: 0 },
    uAssemble: { value: 0 },
    uKick: { value: 0 },
    uPointer: { value: new THREE.Vector2(9999, 9999) },
    uPointerVel: { value: new THREE.Vector2() },
    uSpeed: { value: 0 },
    textureTargets: { value: targets.texture },
  });
  posVar.material.uniforms.uDt = { value: 0 };

  const err = g.init();
  if (err) {
    g.dispose();
    targets.dispose();
    throw new Error(`GPGPU init failed: ${err}`);
  }

  const bang = g.createShaderMaterial(BIG_BANG, { uMode: { value: 0 } });
  for (const rt of posVar.renderTargets) {
    g.doRenderTarget(bang, rt);
  }
  bang.uniforms.uMode.value = 1;
  for (const rt of velVar.renderTargets) {
    g.doRenderTarget(bang, rt);
  }
  bang.dispose();

  const targetMat = g.createShaderMaterial(TARGETS, {
    uMask: { value: null },
    uBox: { value: new THREE.Vector4() },
    uWorld: { value: new THREE.Vector2(NAME_W, (NAME_W * MASK_H) / MASK_W) },
  });

  return {
    g,
    velVar,
    posVar,
    bakeTargets(mask: NameMask) {
      targetMat.uniforms.uMask.value = mask.texture;
      targetMat.uniforms.uBox.value.copy(mask.box);
      g.doRenderTarget(targetMat, targets);
    },
    dispose() {
      g.dispose();
      targets.dispose();
      targetMat.dispose();
    },
  };
}

/* Rasterize the name once with the real Fraunces face (Vietnamese subset
   included) and return it as a mask texture plus the ink's uv bounds. */
export async function loadNameMask(): Promise<NameMask> {
  const family =
    getComputedStyle(document.documentElement).getPropertyValue("--font-fraunces").trim() ||
    "Fraunces, Georgia, serif";
  await document.fonts.load(`600 250px ${family}`, NAME_TEXT).catch(() => undefined);

  const cv = document.createElement("canvas");
  cv.width = MASK_W;
  cv.height = MASK_H;
  const ctx = cv.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas unavailable");
  }
  let size = 250;
  ctx.font = `600 ${size}px ${family}`;
  size = Math.min(250, Math.floor((size * MASK_W * 0.94) / Math.max(ctx.measureText(NAME_TEXT).width, 1)));
  ctx.font = `600 ${size}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  const y = MASK_H / 2 + size * 0.1;
  ctx.fillText(NAME_TEXT, MASK_W / 2, y);

  const m = ctx.measureText(NAME_TEXT);
  const pad = 2;
  const x0 = Math.max(0, MASK_W / 2 - m.actualBoundingBoxLeft - pad);
  const x1 = Math.min(MASK_W, MASK_W / 2 + m.actualBoundingBoxRight + pad);
  const top = Math.max(0, y - m.actualBoundingBoxAscent - pad);
  const bottom = Math.min(MASK_H, y + m.actualBoundingBoxDescent + pad);

  const texture = new THREE.CanvasTexture(cv);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  const box = new THREE.Vector4(x0 / MASK_W, 1 - bottom / MASK_H, x1 / MASK_W, 1 - top / MASK_H);
  return { texture, box };
}
