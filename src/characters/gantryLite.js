// Background GANTRY-class units: the same silhouette as GANTRY, merged into one mesh per unit
// (plus a glowing eye) so a squad of them costs two draw calls each.
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

let sharedGeo = null;
function geometry() {
  if (!sharedGeo) sharedGeo = mergeSimple(PARTS.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)));
  return sharedGeo;
}

export const SQUAD_COLORS = [0xb3262e, 0x2a5bd7, 0x1f9e6a, 0xd9dde3, 0xe06a1b, 0x7a3fd0];

export function createGantryLite(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(geometry(), new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.25 }));
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.2, 0.12) }));
  eye.position.set(0, 8.4, 1.3);
  group.add(body, eye);
  group.scale.setScalar(1.15);
  return group;
}
