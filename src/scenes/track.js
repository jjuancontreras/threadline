// Elevated maglev guideway: beam, teal guide strip, pylons; the severable bridge segment.
import * as THREE from 'three';
import { WORLD } from '../core/layout.js';

const { track, bridge, gap } = WORLD;

function beam(x0, x1, mat, stripMat) {
  const g = new THREE.Group();
  const len = x1 - x0;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 1.8, track.halfWidth * 2), mat);
  deck.position.set((x0 + x1) / 2, track.y - 0.9, track.z);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.5), stripMat);
  strip.position.set((x0 + x1) / 2, track.y + 0.06, track.z);
  const railL = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 0.35), mat);
  railL.position.set((x0 + x1) / 2, track.y + 0.25, track.z - track.halfWidth + 0.2);
  const railR = railL.clone();
  railR.position.z = track.z + track.halfWidth - 0.2;
  g.add(deck, strip, railL, railR);
  return g;
}

export function createTrack() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.55, metalness: 0.5 });
  const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 1.6, 1.5) });
  group.add(beam(track.xMin, gap.xMin, mat, stripMat));
  group.add(beam(gap.xMax, track.xMax, mat, stripMat));

  const pylonGeo = new THREE.BoxGeometry(2.4, track.y - 1.8, 2.4).translate(0, (track.y - 1.8) / 2, 0);
  for (let x = track.xMin; x < track.xMax; x += 36) {
    if (x > bridge.xMin && x < bridge.xMax) continue;
    const p = new THREE.Mesh(pylonGeo, mat);
    p.position.set(x, 0, track.z);
    group.add(p);
  }
  // bridge truss: two arches over the free span
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x8a93a3, roughness: 0.4, metalness: 0.7 });
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const x = THREE.MathUtils.lerp(bridge.xMin, bridge.xMax, u);
      pts.push(new THREE.Vector3(x, track.y + Math.sin(u * Math.PI) * 9, track.z + side * (track.halfWidth + 0.3)));
    }
    const arch = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.35, 6), trussMat);
    group.add(arch);
    for (let i = 1; i < 12; i++) {
      const u = i / 12;
      const x = THREE.MathUtils.lerp(bridge.xMin, bridge.xMax, u);
      if (x > gap.xMin && x < gap.xMax) continue;
      const h = Math.sin(u * Math.PI) * 9;
      const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.15, h, 0.15), trussMat);
      hanger.position.set(x, track.y + h / 2, track.z + side * (track.halfWidth + 0.3));
      group.add(hanger);
    }
  }

  // the section GANTRY severs
  const segment = beam(gap.xMin, gap.xMax, mat, stripMat);
  const pivot = new THREE.Group();
  pivot.position.set(gap.xMax, track.y, track.z);
  segment.position.set(-gap.xMax, -track.y, -track.z);
  pivot.add(segment);
  group.add(pivot);

  return {
    group,
    /** collapse 0..1: segment tears loose at the west end, swings down, then drops. */
    setCollapse(c) {
      const hinge = Math.min(c / 0.45, 1);
      const fall = Math.max((c - 0.45) / 0.55, 0);
      pivot.rotation.z = hinge * 1.15 + fall * 0.5;
      pivot.position.y = track.y - fall * fall * 60;
      pivot.position.x = gap.xMax + fall * 4;
      pivot.visible = pivot.position.y > -10;
    },
  };
}
