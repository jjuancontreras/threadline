// Tattered under-arm "web cape" membranes (Spider-Man 2099). Rebuilt in world space every
// frame from the rig's joint positions, so it follows every pose, trick and run cycle.
import * as THREE from 'three';

const COLS = 9; // samples from armpit/shoulder (0) to hip/wrist (1)
const TATTERS = 7; // saw-teeth along the free edge between wrist and hip

/**
 * @param {THREE.Material} material double-sided membrane material
 * @returns {{mesh: THREE.Mesh, sync: (arm: THREE.Vector3[], body: THREE.Vector3[], time: number, flutter: number) => void}}
 *   arm = [shoulder, elbow, wrist], body = [armpit, waist, hip]
 */
export function createCape(material) {
  const topVerts = (COLS + 1) * 2;
  // free edge: line points L_1..L_{T-1} between wrist (L_0) and hip (L_T), plus one tooth per gap
  const edgeVerts = TATTERS * 2 - 1;
  const pos = new Float32Array((topVerts + edgeVerts) * 3);
  const index = [];
  for (let i = 0; i < COLS; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const wrist = COLS * 2;
  const hip = COLS * 2 + 1;
  const tooth = (k) => topVerts + k;
  const line = (j) => (j === 0 ? wrist : j === TATTERS ? hip : topVerts + TATTERS + j - 1);
  for (let k = 0; k < TATTERS; k++) index.push(line(k), tooth(k), line(k + 1));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;

  const along = (pts, t, out) => {
    const f = t * (pts.length - 1);
    const i = Math.min(Math.floor(f), pts.length - 2);
    return out.lerpVectors(pts[i], pts[i + 1], f - i);
  };
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const drop = new THREE.Vector3();
  const span = new THREE.Vector3();

  return {
    mesh,
    sync(arm, body, time, flutter) {
      for (let i = 0; i <= COLS; i++) {
        const t = i / COLS;
        along(arm, t, a);
        along(body, t, b);
        pos.set([a.x, a.y, a.z], i * 6);
        pos.set([b.x, b.y, b.z], i * 6 + 3);
      }
      // saw-tooth free edge: alternate points sag away from the wrist→hip line
      const w = arm[arm.length - 1];
      const h = body[body.length - 1];
      drop.subVectors(body[0], h).cross(span.subVectors(w, h)).normalize();
      for (let k = 0; k < TATTERS; k++) {
        const wave = Math.sin(time * 14 + k * 1.7) * 0.02 * flutter;
        mid.lerpVectors(w, h, (k + 0.5) / TATTERS).addScaledVector(drop, 0.02 + wave);
        mid.y -= 0.12 + (k % 2) * 0.08; // world metres (hero is scaled x1.5)
        pos.set([mid.x, mid.y, mid.z], (topVerts + k) * 3);
      }
      for (let j = 1; j < TATTERS; j++) {
        mid.lerpVectors(w, h, j / TATTERS);
        pos.set([mid.x, mid.y, mid.z], (topVerts + TATTERS + j - 1) * 3);
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
}
