// THREADRUNNER — original hero: matte-black suit with neon-red filament lines and a plain
// rounded helmet with a thin horizontal visor bar (no emblem, no web pattern, no eye lenses).
import * as THREE from 'three';
import { joint, capsule, box, filament, applyPoses, orient } from './rig.js';
import { POSES, gaitOffsets } from './poses.js';

export const NEON = new THREE.Color(2.4, 0.03, 0.035); // stays red through ACES instead of drifting orange
const POSE_RATE = 9; // 1/s — pose cross-fade speed
const TURN_RATE = 10; // 1/s — body orientation smoothing

function buildBody(suit, plate, glow) {
  const root = new THREE.Group(); // at pelvis
  const body = new THREE.Group();
  root.add(body);
  const j = {};
  body.add(box(0.34, 0.18, 0.2, suit));
  j.spine = joint(body, 0, 0.08, 0);
  const torso = capsule(0.17, 0.34, suit);
  torso.position.y = 0.3;
  j.spine.add(torso);
  j.spine.add(box(0.36, 0.2, 0.2, plate, 0, 0.5, 0.02));
  const diag = box(0.02, 0.5, 0.02, glow, 0.02, 0.33, 0.175);
  diag.rotation.z = 0.62;
  j.spine.add(diag, box(0.02, 0.5, 0.02, glow, 0, 0.32, -0.175), box(0.3, 0.02, 0.02, glow, 0, 0.12, 0.16));

  j.head = joint(j.spine, 0, 0.66, 0);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), plate);
  helmet.scale.set(0.92, 1.08, 1.0);
  helmet.position.y = 0.12;
  j.head.add(helmet, box(0.17, 0.022, 0.05, glow, 0, 0.13, 0.115), box(0.02, 0.1, 0.24, glow, 0, 0.24, -0.01));

  const feet = [];
  const arm = (side) => {
    const s = joint(j.spine, side * 0.23, 0.55, 0);
    s.add(capsule(0.06, 0.24, suit), filament(0.3, glow, [side * 0.062, 0.01, 0]));
    const e = joint(s, 0, -0.31, 0);
    e.add(capsule(0.052, 0.22, suit), filament(0.26, glow, [side * 0.054, 0, 0]));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), plate);
    hand.position.y = -0.3;
    e.add(hand);
    return [s, e, hand];
  };
  const leg = (side) => {
    const h = joint(body, side * 0.1, -0.06, 0);
    h.add(capsule(0.08, 0.34, suit), filament(0.42, glow, [side * 0.082, 0, 0]));
    const k = joint(h, 0, -0.44, 0);
    k.add(capsule(0.065, 0.34, suit), filament(0.4, glow, [side * 0.068, 0, 0.01]));
    const foot = box(0.1, 0.07, 0.24, plate, 0, -0.45, 0.05);
    k.add(foot);
    feet.push(foot);
    return [h, k];
  };
  let handR;
  let handL;
  [j.shL, j.elL, handL] = arm(1);
  [j.shR, j.elR, handR] = arm(-1);
  [j.hipL, j.knL] = leg(1);
  [j.hipR, j.knR] = leg(-1);
  return { root, body, j, feet, handR, handL };
}

export function createThreadrunner() {
  const suit = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.78, metalness: 0.2 });
  const plate = new THREE.MeshStandardMaterial({ color: 0x121317, roughness: 0.45, metalness: 0.45 });
  const glow = new THREE.MeshBasicMaterial({ color: NEON.clone() });
  const { root, body, j, feet, handR, handL } = buildBody(suit, plate, glow);

  const light = new THREE.PointLight(0xff2418, 1.6, 6, 2);
  light.position.set(0, 0.4, 0.3);
  root.add(light);

  const smoothed = {};
  const baseQuat = new THREE.Quaternion();
  const targetQuat = new THREE.Quaternion();
  const trickQuat = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const box3 = new THREE.Box3();
  let time = 0;
  let primed = false;

  function blendWeights(weights, dt, snap) {
    const k = snap || !primed ? 1 : 1 - Math.exp(-dt * POSE_RATE);
    for (const name of new Set([...Object.keys(smoothed), ...Object.keys(weights)])) {
      const cur = smoothed[name] || 0;
      const next = cur + ((weights[name] || 0) - cur) * k;
      if (next < 0.002 && !weights[name]) delete smoothed[name];
      else smoothed[name] = next;
    }
  }

  return {
    root,
    glow,
    poses: POSES,
    /**
     * @param weights pose weights e.g. { swing: 1 }
     * @param dt seconds (for cross-fading)
     * @param opts {{snap?:boolean, gait?:{phase:number, amount:number}}}
     */
    pose(weights, dt = 0, opts = {}) {
      time += dt;
      blendWeights(weights, dt, opts.snap);
      const list = Object.entries(smoothed).filter(([k, w]) => w > 0.001 && POSES[k]).map(([k, w]) => [POSES[k], w]);
      applyPoses(j, list.length ? list : [[POSES.stand, 1]]);
      j.spine.rotation.x += Math.sin(time * 2.1) * 0.025;
      j.head.rotation.y += Math.sin(time * 0.7) * 0.06;
      let drop = (smoothed.crouch || 0) * 0.42 + (smoothed.perch || 0) * 0.46 + (smoothed.land || 0) * 0.36 + (smoothed.tuck || 0) * 0.1;
      if (opts.gait && opts.gait.amount > 0) {
        const g = gaitOffsets(opts.gait.phase, opts.gait.amount);
        for (const name of ['hipL', 'hipR', 'knL', 'knR', 'shL', 'shR']) j[name].rotation.x += g[name][0];
        drop -= g.bounce;
      }
      body.position.y = -drop;
      primed = true;
    },
    flutter(amount) {
      j.knL.rotation.x += Math.sin(time * 23) * 0.12 * amount;
      j.knR.rotation.x += Math.cos(time * 19) * 0.12 * amount;
      j.elL.rotation.x += Math.sin(time * 17) * 0.1 * amount;
    },
    pulse(k) {
      glow.color.copy(NEON).multiplyScalar(1 + k);
    },
    /**
     * Smoothly orient the body (+Y along `up`, +Z facing `forward`), then apply an
     * optional acrobatic rotation on top (unsmoothed, so spins stay crisp).
     */
    orient(up, forward, { dt = 0, snap = false, trick = null } = {}) {
      orient(root, up, forward);
      targetQuat.copy(root.quaternion);
      if (snap || !primed || dt <= 0) baseQuat.copy(targetQuat);
      else baseQuat.slerp(targetQuat, 1 - Math.exp(-dt * TURN_RATE));
      root.quaternion.copy(baseQuat);
      if (trick && trick.angle) {
        axis.set(trick.axis[0], trick.axis[1], trick.axis[2]).normalize();
        trickQuat.setFromAxisAngle(axis, trick.angle);
        root.quaternion.premultiply(trickQuat);
      }
    },
    face(forward) {
      orient(root, [0, 1, 0], forward);
    },
    hand(which = 'R') {
      (which === 'L' ? handL : handR).getWorldPosition(tmp);
      return [tmp.x, tmp.y, tmp.z];
    },
    /** Lowest world Y of the feet — used to plant the hero exactly on a surface. */
    feetY() {
      root.updateMatrixWorld(true);
      let min = Infinity;
      for (const f of feet) {
        box3.setFromObject(f);
        min = Math.min(min, box3.min.y);
      }
      return min;
    },
  };
}
