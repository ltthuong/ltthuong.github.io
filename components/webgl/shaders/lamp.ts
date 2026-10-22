import { hero } from "../hero-store";

/* The cursor lamp, shared by every hero shader. uLamp is the lamp in world
   space, uLampOn fades it in once the pointer has moved. */
export const LAMP_GLSL = /* glsl */ `
  uniform vec3 uLamp;
  uniform float uLampOn;

  // light a point lamp scatters into a camera ray over [0, len], closed form:
  // integral of 1 / ((t + b)^2 + h^2) dt
  float lampScatter(vec3 ro, vec3 rd, float len) {
    vec3 q = ro - uLamp;
    float b = dot(rd, q);
    float h = sqrt(max(dot(q, q) - b * b, 1e-4));
    return (atan((len + b) / h) - atan(b / h)) / h;
  }

  float lampDirect(vec3 p, float k) {
    vec3 d = p - uLamp;
    return uLampOn / (1.0 + dot(d, d) * k);
  }
`;

export function lampUniforms() {
  return { uLamp: { value: hero.lamp }, uLampOn: { value: 0 } };
}
