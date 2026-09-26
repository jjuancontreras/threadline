// Procedural city: instanced towers + rooftop water tanks, AC boxes, antennas & beacons.
import * as THREE from 'three';
import { createTowerMaterial } from '../shaders/tower.js';
import { rng } from '../core/math.js';

const TINTS = [
  [0.55, 0.6, 0.75],
  [0.7, 0.62, 0.55],
  [0.45, 0.55, 0.62],
  [0.62, 0.6, 0.66],
  [0.5, 0.48, 0.58],
];

function buildTowers(towers, shared) {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, createTowerMaterial(shared), towers.length);
  const seeds = new Float32Array(towers.length);
  const tints = new Float32Array(towers.length * 3);
  const m = new THREE.Matrix4();
  const r = rng(99);
  towers.forEach((t, i) => {
    m.makeScale(t.w * 2, t.h, t.d * 2).setPosition(t.x, 0, t.z);
    mesh.setMatrixAt(i, m);
    seeds[i] = r();
    const tint = t.kind === 'spire' ? [0.5, 0.58, 0.72] : TINTS[Math.floor(r() * TINTS.length)];
    tints.set(tint, i * 3);
  });
  const seedAttr = new THREE.InstancedBufferAttribute(seeds, 1);
  const tintAttr = new THREE.InstancedBufferAttribute(tints, 3);
  geo.setAttribute('aSeed', seedAttr);
  geo.setAttribute('aTint', tintAttr);
  mesh.frustumCulled = false;
  return { mesh, sort: createFrontToBackSort(towers, mesh, seedAttr, tintAttr) };
}

/**
 * Instances draw in buffer order. Re-ordering them nearest-first lets the depth test
 * reject hidden facades before the window shader runs — the city's biggest GPU cost
 * inside the avenue canyon (heavy overdraw). Re-sorts only after the camera moves.
 */
function createFrontToBackSort(towers, mesh, seedAttr, tintAttr) {
  const n = towers.length;
  const baseMatrix = mesh.instanceMatrix.array.slice();
  const baseSeed = seedAttr.array.slice();
  const baseTint = tintAttr.array.slice();
  const order = new Uint16Array(n).map((_, i) => i);
  const dist = new Float32Array(n);
  const last = new THREE.Vector3(Infinity, 0, 0);
  const RESORT_DISTANCE = 12;
  return (camPos) => {
    if (last.distanceToSquared(camPos) < RESORT_DISTANCE * RESORT_DISTANCE) return false;
    last.copy(camPos);
    for (let i = 0; i < n; i++) {
      const t = towers[i];
      const dx = Math.max(Math.abs(camPos.x - t.x) - t.w, 0);
      const dz = Math.max(Math.abs(camPos.z - t.z) - t.d, 0);
      dist[i] = dx * dx + dz * dz;
    }
    order.sort((a, b) => dist[a] - dist[b]);
    const m = mesh.instanceMatrix.array;
    for (let k = 0; k < n; k++) {
      const i = order[k];
      m.set(baseMatrix.subarray(i * 16, i * 16 + 16), k * 16);
      seedAttr.array[k] = baseSeed[i];
      tintAttr.array.set(baseTint.subarray(i * 3, i * 3 + 3), k * 3);
    }
    mesh.instanceMatrix.needsUpdate = true;
    seedAttr.needsUpdate = true;
    tintAttr.needsUpdate = true;
    return true;
  };
}

function instanced(geo, mat, placements) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(placements.length, 1));
  mesh.count = placements.length;
  placements.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.frustumCulled = false;
  return mesh;
}

function buildRooftops(towers, detail) {
  const r = rng(4242);
  const tanks = [];
  const boxes = [];
  const masts = [];
  const beacons = [];
  const m = () => new THREE.Matrix4();
  for (const t of towers) {
    if (t.kind === 'spire') continue;
    const roll = r();
    if (roll < 0.35 * detail && t.h < 120) {
      const x = t.x + (r() - 0.5) * t.w;
      const z = t.z + (r() - 0.5) * t.d;
      tanks.push(m().makeScale(1, 1, 1).setPosition(x, t.h, z));
    }
    if (r() < 0.6 * detail) {
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const sx = 1.5 + r() * 3;
        const sz = 1.5 + r() * 3;
        boxes.push(m().makeScale(sx, 1.2 + r(), sz).setPosition(t.x + (r() - 0.5) * (t.w * 2 - sx), t.h, t.z + (r() - 0.5) * (t.d * 2 - sz)));
      }
    }
    if (t.h > 70 && r() < 0.55) {
      const hgt = 8 + r() * 18;
      const x = t.x + (r() - 0.5) * t.w * 0.8;
      const z = t.z + (r() - 0.5) * t.d * 0.8;
      masts.push(m().makeScale(0.35, hgt, 0.35).setPosition(x, t.h, z));
      beacons.push(m().makeScale(0.9, 0.9, 0.9).setPosition(x, t.h + hgt, z));
    }
  }
  return { tanks, boxes, masts, beacons };
}

function tankGeometry() {
  const body = new THREE.CylinderGeometry(2.2, 2.2, 3.6, 12).translate(0, 5.2, 0);
  const cap = new THREE.ConeGeometry(2.4, 1.4, 12).translate(0, 7.7, 0);
  const legs = [-1, 1].flatMap((a) => [-1, 1].map((b) => new THREE.BoxGeometry(0.25, 3.4, 0.25).translate(a * 1.4, 1.7, b * 1.4)));
  return mergeSimple([body, cap, ...legs]);
}

/** Minimal non-indexed merge (avoids pulling BufferGeometryUtils into the bundle). */
export function mergeSimple(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

function beaconMaterial(shared) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime },
    vertexShader: /* glsl */ `
      varying float vPhase;
      void main() {
        vPhase = fract(instanceMatrix[3][0] * 0.013 + instanceMatrix[3][2] * 0.007);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying float vPhase;
      void main() {
        float blink = step(0.55, fract(uTime * 0.6 + vPhase));
        gl_FragColor = vec4(vec3(3.2, 0.18, 0.12) * (0.15 + blink), 1.0);
      }`,
  });
}

function buildSpire(spire) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x151a24, metalness: 0.5, roughness: 0.55 });
  const crown = new THREE.Mesh(new THREE.BoxGeometry(spire.w * 1.4, 4, spire.d * 1.4), mat);
  crown.position.set(spire.x, spire.h - 1.6, spire.z); // top sits 0.4 m above the roof: no z-fighting
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.6, spire.needle, 8), mat);
  needle.position.set(spire.x - 3, spire.h + spire.needle / 2, spire.z + 3);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.12, 6, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.4, 2.1) }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(spire.x - 3, spire.h + spire.needle * 0.7, spire.z + 3);
  group.add(crown, needle, ring);
  return group;
}

export function createCity(towers, shared, quality) {
  const group = new THREE.Group();
  const built = buildTowers(towers, shared);
  group.add(built.mesh);
  const roofs = buildRooftops(towers, quality.detail);
  const propMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.85, metalness: 0.2 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.9 });
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  group.add(instanced(tankGeometry(), tankMat, roofs.tanks));
  group.add(instanced(box, propMat, roofs.boxes));
  group.add(instanced(box, propMat, roofs.masts));
  group.add(instanced(new THREE.SphereGeometry(0.5, 8, 6), beaconMaterial(shared), roofs.beacons));
  const spire = towers.find((t) => t.kind === 'spire');
  if (spire) group.add(buildSpire(spire));
  return { group, update: (camPos) => built.sort(camPos) };
}
