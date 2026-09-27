// Presentation for wall running: where the hero's body goes, how it is oriented, which pose and
// gait it uses, and the camera that frames it. The movement itself is physics/wallrun.js.
import { vAdd, vScale, vNorm, smoothstep } from '../../core/math.js';
import { faceRight, WALL } from '../../physics/wallrun.js';

const HIP = 1.62; // pelvis height above the facade when standing on it (hero scale 1.5)

/**
 * @param {object} w wall state
 * @param {number} gaitPhase running phase (radians)
 * @returns {{pos:number[], up:number[], forward:number[], weights:object, gait?:object, shot:object, speed:number}}
 */
export function wallFrame(w, gaitPhase) {
  const right = faceRight(w.n);
  const [va, vu] = w.v;
  const speed = Math.hypot(va, vu);
  const moveDir = speed > 0.5 ? vNorm(vAdd(vScale(right, va), [0, vu, 0])) : [0, 1, 0];
  const moving = smoothstep(0.4, 2.5, speed);
  const run = smoothstep(5, 14, speed);
  // crouched and clinging when still, sprinting "on" the wall when moving (up = face normal)
  const lift = HIP - WALL.standOff - (1 - moving) * 0.55;
  const pos = vAdd(w.pos, vScale(w.n, lift));
  const weights = { crouch: (1 - moving) * 0.8, perch: (1 - moving) * 0.2, walk: moving * (1 - run), run: moving * run };
  // camera: out from the wall, a little behind the direction of travel
  const back = vScale(moveDir, -5 - run * 3);
  const shot = {
    pos: vAdd(vAdd(pos, vScale(w.n, 9 + run * 2)), back),
    look: vAdd(pos, vScale(moveDir, 6)),
    fov: 62 + run * 10,
    lag: 0.14,
    collide: true,
    k: run * 0.5,
  };
  return {
    pos,
    up: w.n,
    forward: moveDir,
    weights,
    gait: moving > 0 ? { phase: gaitPhase, amount: moving, run } : undefined,
    shot,
    speed,
  };
}
