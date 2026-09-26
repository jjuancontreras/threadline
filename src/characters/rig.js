// Shared helpers for primitive-built character rigs: joints, limb segments, pose blending.
import * as THREE from 'three';

/** A joint is a Group; `segment` hangs a mesh below it (along -Y) of the given length. */
export function joint(parent, x, y, z) {
  const j = new THREE.Group();
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

export function capsule(radius, length, mat, segments = 8) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, segments), mat);
  m.position.y = -length / 2;
  return m;
}

export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/** Glowing filament strip running along a limb (for bloom). */
export function filament(length, mat, offset = [0, 0, 0], thickness = 0.018) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(thickness, length, thickness), mat);
  m.position.set(offset[0], -length / 2 + offset[1], offset[2]);
  return m;
}

/**
 * Blend a list of [pose, weight] into joint rotations. Poses are
 * { jointName: [rx, ry, rz] } objects; missing joints default to 0.
 */
export function applyPoses(joints, weighted) {
  const total = weighted.reduce((s, [, w]) => s + w, 0) || 1;
  for (const name of Object.keys(joints)) {
    let rx = 0;
    let ry = 0;
    let rz = 0;
    for (const [pose, w] of weighted) {
      const r = pose[name];
      if (!r) continue;
      rx += r[0] * w;
      ry += r[1] * w;
      rz += r[2] * w;
    }
    joints[name].rotation.set(rx / total, ry / total, rz / total);
  }
}

const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();

/** Orient `obj` so its +Y points along `up` and +Z faces `forward` (orthonormalised). */
export function orient(obj, up, forward) {
  _y.set(up[0], up[1], up[2]).normalize();
  _z.set(forward[0], forward[1], forward[2]);
  _z.addScaledVector(_y, -_z.dot(_y));
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1).addScaledVector(_y, -_y.z);
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  obj.quaternion.setFromRotationMatrix(_m);
}
