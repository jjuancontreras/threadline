// Background GANTRY-class units: the same silhouette as GANTRY, merged into one mesh per unit
// plus a dark-steel trim mesh (shoulder pads, exhaust stacks, knee plates, backpack) and two
// emissive bits (eye, blinking beacon): four draw calls per unit.
import * as THREE from 'three';
import { mergeSimple } from '../scenes/city.js';

const PARTS = [
  // [w, h, d, x, y, z]  — hips at y≈4
  [2.8, 1.0, 2.0, 0, 4.2, 0],
  [4.0, 3.0, 2.8, 0, 6.3, 0],
  [1.8, 1.1, 1.5, 0, 8.3, 0.5],
  [1.2, 2.2, 1.2, 2.6, 5.9, 0.2],
  [1.2, 2.2, 1.2, -2.6, 5.9, 0.2],
  [1.1, 2.4, 1.1, 2.7, 3.7, 0.6],
  [1.1, 2.4, 1.1, -2.7, 3.7, 0.6],
  [1.2, 2.0, 1.3, 1.05, 2.9, 0],
  [1.2, 2.0, 1.3, -1.05, 2.9, 0],
  [1.4, 1.9, 1.4, 1.05, 1.2, 0],
  [1.4, 1.9, 1.4, -1.05, 1.2, 0],
  [1.9, 0.5, 2.6, 1.05, 0.25, 0.35],
  [1.9, 0.5, 2.6, -1.05, 0.25, 0.35],
];

const TRIM = [
  [1.6, 0.7, 1.7, 2.75, 7.3, 0.1],
  [1.6, 0.7, 1.7, -2.75, 7.3, 0.1],
  [0.45, 1.8, 0.45, 1.2, 8.4, -1.1],
  [0.45, 1.8, 0.45, -1.2, 8.4, -1.1],
  [1.5, 0.6, 0.35, 1.05, 2.3, 0.75],
  [1.5, 0.6, 0.35, -1.05, 2.3, 0.75],
  [3.2, 2.0, 0.5, 0, 6.4, -1.6],
  [3.0, 0.45, 0.12, 0, 5.2, 1.45],
];

const cache = {};
const merged = (key, parts) =>
  (cache[key] ??= mergeSimple(parts.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z))));
const trimMat = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.55, metalness: 0.6 });

export const SQUAD_COLORS = [0xb3262e, 0x2a5bd7, 0x1f9e6a, 0xd9dde3, 0xe06a1b, 0x7a3fd0];

export function createGantryLite(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(merged('body', PARTS), new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.25 }));
  const trim = new THREE.Mesh(merged('trim', TRIM), trimMat);
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.1, 0.1) });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.3, 8), beaconMat);
  beacon.position.set(0.6, 9.05, 0);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.2, 0.12) }));
  eye.position.set(0, 8.4, 1.3);
  group.add(body, trim, eye, beacon);
  /** Blink the roof beacon; phase offsets keep the squad out of sync. */
  group.userData.blink = (time, phase) => {
    beaconMat.color.setRGB(2.4, 1.1, 0.1).multiplyScalar(0.1 + 0.9 * Math.max(0, Math.sin(time * 4.2 + phase)));
  };
  group.scale.setScalar(1.15);
  return group;
}
