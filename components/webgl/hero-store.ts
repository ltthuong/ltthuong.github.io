import { Vector2, Vector3 } from "three";

/* Per-frame hero state shared by the DOM listeners and the scene.
   Plain module object: written every frame, never triggers React. */
export const hero = {
  now: 0,
  moved: false,
  kick: 0,
  pendingBurst: false,
  burstT: -100,
  burstX: 0,
  burstY: 0,
  pointer: new Vector3(0, 0, 0),
  lamp: new Vector3(0, 0, 0),
  lampVel: new Vector2(0, 0),
  lampOn: 0,
};

export function resetHero() {
  hero.now = 0;
  hero.moved = false;
  hero.kick = 0;
  hero.pendingBurst = false;
  hero.burstT = -100;
  hero.pointer.set(0, 0, 0);
  hero.lamp.set(0, 0, 0);
  hero.lampVel.set(0, 0);
  hero.lampOn = 0;
}
