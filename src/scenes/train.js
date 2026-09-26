// Maglev train: three cars built from primitives with an emissive window band.
// Car positions also drive three dynamic lights that wash the tower facades.
import * as THREE from 'three';
import { WORLD } from '../core/layout.js';
import { setLight, LIGHT } from '../core/shared.js';

const { track, train } = WORLD;

function car(isLead) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.3, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.4, metalness: 0.5 });
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.45, 1.0) });
  const teal = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 1.8, 1.6) });
  const L = train.carLength;
  const shell = new THREE.Mesh(new THREE.BoxGeometry(L, 3.4, 3.6), body);
  shell.position.y = 2.6;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, L, 12, 1, false, 0, Math.PI), body);
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.scale.set(1, 1, 0.45);
  roof.position.y = 4.3;
  const windows = new THREE.Mesh(new THREE.BoxGeometry(L - 1.6, 1.1, 3.66), glow);
  windows.position.y = 3.0;
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(L - 0.4, 0.9, 3.2), dark);
  skirt.position.y = 0.6;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(L - 0.2, 0.14, 3.68), teal);
  stripe.position.y = 1.35;
  g.add(shell, roof, windows, skirt, stripe);
  if (isLead) {
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.9, 6, 12), body);
    nose.rotation.z = -Math.PI / 2;
    nose.scale.set(1, 1, 0.95);
    nose.position.set(L / 2 + 3, 2.4, 0);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 3.0), dark);
    shield.position.set(L / 2 + 0.9, 3.5, 0);
    shield.rotation.z = -0.5;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.8, 2.4) }));
    lamp.position.set(L / 2 + 5.6, 2.2, 0);
    g.add(nose, shield, lamp);
  }
  return g;
}

export const NOSE_OFFSET = train.carLength / 2 + 6; // lead-car centre → nose tip
export const ROOF_TOP = track.y + 0.35 + 4.3 + 0.8; // top of the rounded car roof

export function createTrain(shared) {
  const group = new THREE.Group();
  const cars = [];
  for (let i = 0; i < train.cars; i++) {
    const c = car(i === 0);
    cars.push(c);
    group.add(c);
  }
  const headlight = new THREE.SpotLight(0xfff1d6, 60, 140, 0.35, 0.6, 1.2);
  headlight.target.position.set(40, -4, 0);
  cars[0].add(headlight, headlight.target);
  headlight.position.set(NOSE_OFFSET, 2.2, 0);

  let wobble = 0;
  return {
    group,
    cars,
    /** Place the train so that its nose tip is at world x = noseX. */
    setNose(noseX, time = 0, shake = 0) {
      wobble = Math.sin(time * 9) * 0.05 * shake;
      cars.forEach((c, i) => {
        const cx = noseX - NOSE_OFFSET - i * (train.carLength + train.carGap);
        c.position.set(cx, track.y + 0.35 + wobble, track.z);
        c.rotation.x = wobble * 0.2;
        setLight(shared, LIGHT.train0 + i, [cx, track.y + 3, track.z], 34, [1.0, 0.78, 0.5], 0.55);
      });
    },
    leadRoof(noseX) {
      return [noseX - NOSE_OFFSET + 5, ROOF_TOP, track.z];
    },
  };
}
