// GANTRY — original villain: industrial yellow-and-rust demolition mech with chrome
// hydraulic pistons, hazard striping and a single red sensor eye. Primitives only.
import * as THREE from 'three';
import { joint, box, applyPoses } from './rig.js';

const EYE_ON = new THREE.Color(4, 0.15, 0.1);

function hazardTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#e0a41c';
  g.fillRect(0, 0, 128, 32);
  g.fillStyle = '#111';
  for (let x = -32; x < 160; x += 24) {
    g.beginPath();
    g.moveTo(x, 32);
    g.lineTo(x + 12, 32);
    g.lineTo(x + 44, 0);
    g.lineTo(x + 32, 0);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rustTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#d99a18';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 90; i++) {
    const r = 2 + Math.random() * 12;
    g.fillStyle = `rgba(${110 + Math.random() * 40},${45 + Math.random() * 20},${20},${0.25 + Math.random() * 0.5})`;
    g.beginPath();
    g.ellipse(Math.random() * 128, Math.random() * 128, r, r * (0.4 + Math.random()), Math.random() * 3, 0, 7);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const POSES = {
  idle: { torso: [0.05, 0, 0], shL: [0.1, 0, 0.15], shR: [0.1, 0, -0.15], elL: [-0.5, 0, 0], elR: [-0.5, 0, 0], hipL: [-0.1, 0, 0], hipR: [-0.1, 0, 0], knL: [0.2, 0, 0], knR: [0.2, 0, 0] },
  land: { torso: [0.5, 0, 0], shL: [-0.6, 0, 0.9], shR: [-0.6, 0, -0.9], elL: [-0.9, 0, 0], elR: [-0.9, 0, 0], hipL: [-1.1, 0, 0.2], hipR: [-1.1, 0, -0.2], knL: [1.8, 0, 0], knR: [1.8, 0, 0] },
  lift: { torso: [-0.3, 0, 0], shL: [-2.9, 0, 0.25], shR: [-2.9, 0, -0.25], elL: [-0.35, 0, 0], elR: [-0.35, 0, 0], hipL: [-0.2, 0, 0.1], hipR: [0.2, 0, -0.1], knL: [0.4, 0, 0], knR: [0.3, 0, 0] },
  throw: { torso: [0.55, 0, 0], shL: [-1.2, 0, 0.2], shR: [-1.2, 0, -0.2], elL: [-0.1, 0, 0], elR: [-0.1, 0, 0], hipL: [-0.7, 0, 0.1], hipR: [0.5, 0, -0.1], knL: [0.8, 0, 0], knR: [0.2, 0, 0] },
};

export function createGantry() {
  const yellow = new THREE.MeshStandardMaterial({ map: rustTexture(), roughness: 0.62, metalness: 0.08 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.6, metalness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 0.25, metalness: 0.55 });
  const hazard = new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: EYE_ON.clone() });
  const heatMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.7, 0.2) });
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.1, 0.1) });

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 4.2;
  root.add(hips);
  const j = {};
  hips.add(box(2.8, 1.0, 2.0, steel));
  j.torso = joint(hips, 0, 0.5, 0);
  j.torso.add(box(4.0, 3.0, 2.8, yellow, 0, 1.6, 0));
  j.torso.add(box(3.2, 0.5, 0.1, hazard, 0, 0.5, 1.45));
  j.torso.add(box(2.2, 1.2, 0.3, steel, 0, 2.0, 1.45)); // chest grille
  for (const s of [-1, 1]) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 1.8, 8), steel);
    stack.position.set(s * 1.2, 3.6, -1.1);
    j.torso.add(stack);
    // exhaust glow in the stack mouth (flickers with the idle engine, see pose())
    const heat = new THREE.Mesh(new THREE.CircleGeometry(0.2, 10), heatMat);
    heat.rotation.x = -Math.PI / 2;
    heat.position.set(s * 1.2, 4.51, -1.1);
    j.torso.add(heat);
  }
  // armour detail: back plate, rivet strips, amber hazard beacon on the cab roof
  j.torso.add(box(3.4, 2.2, 0.25, steel, 0, 1.7, -1.5));
  for (const y of [0.7, 2.7]) j.torso.add(box(4.05, 0.12, 2.85, steel, 0, y, 0));
  // cab with single sensor eye
  const cab = joint(j.torso, 0, 3.1, 0.5);
  cab.add(box(1.8, 1.1, 1.5, yellow, 0, 0.5, 0), box(1.3, 0.45, 0.2, steel, 0, 0.55, 0.78));
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), eyeMat);
  eye.position.set(0, 0.55, 0.9);
  cab.add(eye);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.28, 10), beaconMat);
  beacon.position.set(0.55, 1.2, -0.4);
  cab.add(beacon);
  // Lights live at scene level (see `lights`) and follow these markers: hiding GANTRY must not
  // change the scene's light count, or every lit material recompiles mid-story (a visible hitch).
  const eyeLight = new THREE.PointLight(0xff2a1a, 0, 22, 2);
  const eyeMarker = joint(cab, 0, 0.6, 1.4);

  const piston = (len, parent, x, z) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, len, 8), chrome);
    p.position.set(x, -len / 2, z);
    parent.add(p);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, len * 0.45, 8), steel);
    sleeve.position.set(x, -len * 0.25, z);
    parent.add(sleeve);
  };
  const arm = (side) => {
    const sh = joint(j.torso, side * 2.5, 2.6, 0);
    sh.add(box(1.3, 1.1, 1.4, steel, side * 0.2, 0, 0));
    sh.add(box(0.95, 2.4, 0.95, yellow, side * 0.25, -1.4, 0));
    piston(2.2, sh, side * 0.25, 0.65);
    const el = joint(sh, side * 0.25, -2.6, 0);
    el.add(box(1.15, 2.4, 1.15, yellow, 0, -1.2, 0));
    piston(2.0, el, 0, -0.7);
    const claw = joint(el, 0, -2.5, 0);
    for (const k of [-1, 0, 1]) {
      const f = box(0.25, 0.9, 0.25, steel, k * 0.35, -0.4, k === 0 ? -0.35 : 0.25);
      f.rotation.x = k === 0 ? -0.35 : 0.35;
      claw.add(f);
    }
    return [sh, el];
  };
  const leg = (side) => {
    const hp = joint(hips, side * 1.05, -0.3, 0);
    hp.add(box(1.2, 2.0, 1.3, yellow, 0, -1.0, 0));
    piston(1.9, hp, side * 0.7, 0);
    const kn = joint(hp, 0, -2.0, 0);
    kn.add(box(1.4, 1.9, 1.4, steel, 0, -0.95, 0), box(1.9, 0.5, 2.6, yellow, 0, -1.9, 0.35));
    return [hp, kn];
  };
  [j.shL, j.elL] = arm(1);
  [j.shR, j.elR] = arm(-1);
  [j.hipL, j.knL] = leg(1);
  [j.hipR, j.knR] = leg(-1);

  const work = new THREE.PointLight(0xffd9a0, 0, 30, 1.6); // sodium work lamp so the yellow reads
  const workMarker = joint(root, 0, 12, 9);

  let time = 0;
  let power = 1; // 0 once GANTRY is shut down after the rescue
  const _v = new THREE.Vector3();
  return {
    root,
    eyeMat,
    eyeLight,
    lights: [eyeLight, work],
    /**
     * Copy marker positions onto the scene-level lights; zero them while GANTRY is hidden.
     * @param eye 0..1 sensor power (0 = shut down after the rescue)
     */
    syncLights(visible, eye = 1) {
      eyeMat.color.copy(EYE_ON).multiplyScalar(0.04 + 0.96 * eye);
      power = eye;
      eyeLight.intensity = visible ? 10 * eye : 0;
      work.intensity = visible ? 90 : 0;
      if (!visible) return;
      root.updateMatrixWorld(true);
      eyeMarker.getWorldPosition(eyeLight.position);
      workMarker.getWorldPosition(work.position);
    },
    pose(weights, dt = 0) {
      time += dt;
      const list = Object.entries(weights).filter(([, w]) => w > 0.001).map(([k, w]) => [POSES[k], w]);
      applyPoses(j, list.length ? list : [[POSES.idle, 1]]);
      j.torso.rotation.z += Math.sin(time * 1.3) * 0.02;
      cab.rotation.y = Math.sin(time * 0.5) * 0.25 * (weights.idle || 0);
      // engine flicker + a rotating-beacon pulse; both die with the sensor eye (see syncLights)
      heatMat.color.setRGB(2.2, 0.7, 0.2).multiplyScalar(power * (0.75 + 0.25 * Math.sin(time * 23) * Math.sin(time * 7.3)));
      beaconMat.color.setRGB(2.4, 1.1, 0.1).multiplyScalar(power * (0.15 + 0.85 * Math.max(0, Math.sin(time * 5))));
      hips.position.y = 4.2 - (weights.land || 0) * 1.6;
    },
    /** Midpoint between the claws — where the container is carried. */
    grip() {
      root.updateMatrixWorld(true);
      const a = j.elL.children[0].getWorldPosition(_v).clone();
      const b = j.elR.children[0].getWorldPosition(_v).clone();
      return a.add(b).multiplyScalar(0.5).toArray();
    },
    eyeWorld() {
      return eye.getWorldPosition(_v).toArray();
    },
  };
}

export function createContainer() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#a3431d';
  g.fillRect(0, 0, 256, 64);
  for (let x = 0; x < 256; x += 8) {
    g.fillStyle = x % 16 ? 'rgba(0,0,0,0.28)' : 'rgba(255,190,140,0.12)';
    g.fillRect(x, 0, 4, 64);
  }
  g.fillStyle = 'rgba(240,230,210,0.85)';
  g.font = 'bold 16px sans-serif';
  g.fillText('KORVEX  45G1', 18, 38);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0.4 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 2.6), mat);
  return mesh;
}
