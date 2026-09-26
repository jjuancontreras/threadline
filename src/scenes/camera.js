// Damped camera rig: chapters set a target shot; the rig eases toward it (or cuts).
import * as THREE from 'three';
import { catmull, clamp } from '../core/math.js';

export function createCameraRig(camera) {
  const pos = new THREE.Vector3(0, 40, 160);
  const look = new THREE.Vector3(0, 60, 0);
  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  let fov = 55;
  let roll = 0;
  return {
    /**
     * @param shot {{pos:number[], look:number[], fov?:number, hfov?:number, roll?:number, cut?:boolean, lag?:number}}
     * @param shake [dx, dy, droll]
     */
    update(shot, dt, shake = [0, 0, 0]) {
      tmpPos.fromArray(shot.pos);
      tmpLook.fromArray(shot.look);
      let targetFov = shot.fov ?? 55;
      if (shot.hfov) {
        const v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(shot.hfov) / 2) / camera.aspect);
        targetFov = Math.min(Math.max(THREE.MathUtils.radToDeg(v), shot.fov ?? 40), 100);
      }
      const k = shot.cut ? 1 : 1 - Math.exp(-dt / (shot.lag ?? 0.28));
      pos.lerp(tmpPos, k);
      look.lerp(tmpLook, k);
      fov += (targetFov - fov) * k;
      roll += ((shot.roll ?? 0) - roll) * k;
      camera.position.copy(pos);
      camera.lookAt(look);
      camera.rotateZ(roll + shake[2]);
      camera.translateX(shake[0]);
      camera.translateY(shake[1]);
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}

/** Evaluate keyed camera shots [{p, pos, look}] at progress p with Catmull-Rom. */
export function keyedShot(keys, p) {
  const n = keys.length - 1;
  let i = 0;
  while (i < n - 1 && p > keys[i + 1].p) i++;
  const u = clamp((p - keys[i].p) / (keys[i + 1].p - keys[i].p));
  const t = (i + u) / n;
  return {
    pos: catmull(keys.map((k) => k.pos), t),
    look: catmull(keys.map((k) => k.look), t),
    fov: keys[i].fov !== undefined ? keys[i].fov + ((keys[i + 1].fov ?? keys[i].fov) - keys[i].fov) * u : undefined,
  };
}
