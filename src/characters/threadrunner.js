// THREADRUNNER in a Spider-Man 2099 (Miguel O'Hara, Across the Spider-Verse) fan-art suit:
// blue-black bodysuit, skull-spider emblem front/back, red skull mask with glowing angular eyes,
// forearm spikes, talons and tattered under-arm web-cape membranes. Personal, unpublished build.
// Joint names/poses are unchanged, so every animation (swing, tricks, run, slingshot) still applies.
import * as THREE from 'three';
import { joint, applyPoses, orient } from './rig.js';
import {
  TORSO, LIMB, torsoGeometry, pelvisGeometry, neckGeometry, deltoidGeometry,
  upperArmGeometry, forearmGeometry, thighGeometry, shinGeometry, footGeometry, handGeometry,
} from './anatomy.js';
import { POSES, gaitOffsets } from './poses.js';
import { SUIT, emblemTextures, faceTextures, faceDecal, forearmSpikes, talons, addRim } from './suit2099.js';
import { createCape } from './cape.js';

export const NEON = SUIT.glow; // emblem/eye glow colour (pulsed by pulse())
const POSE_RATE = 9; // 1/s — pose cross-fade speed
const TURN_RATE = 10; // 1/s — body orientation smoothing

function buildBody(m) {
  const root = new THREE.Group(); // at pelvis
  const body = new THREE.Group();
  root.add(body);
  const j = {};
  const mesh = (geo, mat) => new THREE.Mesh(geo, mat);
  body.add(mesh(pelvisGeometry(), m.suit));
  j.spine = joint(body, 0, 0.08, 0);
  // sculpted V-taper torso; the skull-spider emblem is UV-mapped straight onto it
  j.spine.add(mesh(torsoGeometry(), m.emblem));
  const neck = mesh(neckGeometry(), m.suit);
  neck.position.y = TORSO.top - 0.05;
  j.spine.add(neck);

  j.head = joint(j.spine, 0, 0.76, 0);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 20), m.suit);
  helmet.scale.set(0.88, 1.1, 1.0);
  helmet.position.y = 0.12;
  const face = faceDecal(m.face);
  face.position.y = 0.12;
  face.scale.copy(helmet.scale);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), m.suit);
  jaw.scale.set(0.95, 0.75, 1.02);
  jaw.position.set(0, 0.04, 0.02);
  j.head.add(helmet, face, jaw);

  const feet = [];
  const markers = { L: {}, R: {} };
  const arm = (side, key) => {
    const s = joint(j.spine, side * 0.3, 0.6, 0);
    const delt = mesh(deltoidGeometry(), m.suit);
    delt.position.set(side * 0.008, -0.045, 0);
    s.add(delt, mesh(upperArmGeometry(side), m.suit));
    const e = joint(s, 0, -LIMB.upperArm, 0);
    e.add(mesh(forearmGeometry(side), m.suit), forearmSpikes(side, m.dark, m.glow));
    const hand = mesh(handGeometry(), m.dark);
    hand.position.y = -LIMB.forearm - 0.045;
    hand.add(talons(m.dark));
    e.add(hand);
    markers[key].shoulder = joint(s, 0, -0.07, 0);
    markers[key].elbow = joint(e, 0, 0, 0);
    markers[key].wrist = joint(e, 0, -LIMB.forearm + 0.03, 0);
    markers[key].armpit = joint(j.spine, side * 0.22, 0.47, -0.03);
    markers[key].waist = joint(j.spine, side * 0.16, 0.14, -0.02);
    markers[key].hip = joint(body, side * 0.16, -0.06, 0);
    return [s, e, hand];
  };
  const leg = (side) => {
    const h = joint(body, side * 0.108, -0.07, 0);
    h.add(mesh(thighGeometry(side), m.suit));
    const k = joint(h, 0, -LIMB.thigh, 0);
    k.add(mesh(shinGeometry(), m.suit));
    const foot = mesh(footGeometry(), m.dark);
    foot.position.set(0, -LIMB.shin - 0.035, 0);
    for (const x of [-1, 0, 1]) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.055, 4), m.dark);
      claw.position.set(x * 0.03, -LIMB.shin - 0.045, 0.24);
      claw.rotation.x = Math.PI / 2;
      k.add(claw);
    }
    k.add(foot);
    feet.push(foot);
    return [h, k];
  };
  let handR;
  let handL;
  [j.shL, j.elL, handL] = arm(1, 'L');
  [j.shR, j.elR, handR] = arm(-1, 'R');
  [j.hipL, j.knL] = leg(1);
  [j.hipR, j.knR] = leg(-1);
  return { root, body, j, feet, handR, handL, markers };
}

function materials() {
  const emblemTex = emblemTextures();
  const faceTex = faceTextures();
  return {
    suit: addRim(new THREE.MeshStandardMaterial({ color: SUIT.base, roughness: 0.62, metalness: 0.25 })),
    dark: new THREE.MeshStandardMaterial({ color: 0x05070f, roughness: 0.4, metalness: 0.6 }),
    glow: new THREE.MeshBasicMaterial({ color: SUIT.glow.clone() }),
    emblem: addRim(new THREE.MeshStandardMaterial({
      map: emblemTex.map,
      emissiveMap: emblemTex.emissive,
      emissive: new THREE.Color(1, 1, 1),
      emissiveIntensity: 0.9,
      roughness: 0.55,
      metalness: 0.25,
    })),
    face: new THREE.MeshStandardMaterial({
      map: faceTex.map,
      emissiveMap: faceTex.emissive,
      emissive: new THREE.Color(1, 1, 1),
      emissiveIntensity: 2.2,
      transparent: true,
      alphaTest: 0.5,
      roughness: 0.5,
    }),
    cape: addRim(new THREE.MeshStandardMaterial({
      color: 0x0b1230,
      emissive: 0x220305,
      roughness: 0.75,
      metalness: 0.1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    }), [0.05, 0.09, 0.26], 2.0),
  };
}

export function createThreadrunner() {
  const m = materials();
  const glow = m.glow;
  const { root, body, j, feet, handR, handL, markers } = buildBody(m);
  const capes = { L: createCape(m.cape), R: createCape(m.cape) };
  const wp = () => new THREE.Vector3();
  const capePts = { L: { arm: [wp(), wp(), wp()], body: [wp(), wp(), wp()] }, R: { arm: [wp(), wp(), wp()], body: [wp(), wp(), wp()] } };

  const light = new THREE.PointLight(0xff2418, 1.2, 6, 2);
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
     * @param opts {{snap?:boolean, gait?:{phase:number, amount:number, run?:number}}}
     */
    pose(weights, dt = 0, opts = {}) {
      time += dt;
      blendWeights(weights, dt, opts.snap);
      const list = Object.entries(smoothed).filter(([k, w]) => w > 0.001 && POSES[k]).map(([k, w]) => [POSES[k], w]);
      applyPoses(j, list.length ? list : [[POSES.stand, 1]]);
      j.spine.rotation.x += Math.sin(time * 2.1) * 0.025;
      j.head.rotation.y += Math.sin(time * 0.7) * 0.06;
      let drop = (smoothed.charge || 0) * 0.62 + (smoothed.crouch || 0) * 0.42 + (smoothed.perch || 0) * 0.46 + (smoothed.land || 0) * 0.36 + (smoothed.tuck || 0) * 0.1;
      if (opts.gait && opts.gait.amount > 0) {
        const g = gaitOffsets(opts.gait.phase, opts.gait.amount, opts.gait.run ?? 0);
        for (const name of ['hipL', 'hipR', 'knL', 'knR', 'shL', 'shR', 'elL', 'elR']) j[name].rotation.x += g[name][0];
        j.spine.rotation.y += g.spine[1];
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
      m.emblem.emissiveIntensity = 0.7 + k * 0.45;
      m.face.emissiveIntensity = 1.8 + k * 0.8;
    },
    /** Scene-level cape membranes (add to the scene once). */
    capeMeshes: [capes.L.mesh, capes.R.mesh],
    /** Rebuild both capes from the current (final) rig pose. Call after the root is placed. */
    syncCape(time, flutter = 0) {
      for (const key of ['L', 'R']) {
        const mk = markers[key];
        const pts = capePts[key];
        mk.shoulder.getWorldPosition(pts.arm[0]);
        mk.elbow.getWorldPosition(pts.arm[1]);
        mk.wrist.getWorldPosition(pts.arm[2]);
        mk.armpit.getWorldPosition(pts.body[0]);
        mk.waist.getWorldPosition(pts.body[1]);
        mk.hip.getWorldPosition(pts.body[2]);
        capes[key].sync(pts.arm, pts.body, time, flutter);
      }
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
      if (trick?.quat) {
        trickQuat.set(trick.quat[0], trick.quat[1], trick.quat[2], trick.quat[3]);
        root.quaternion.premultiply(trickQuat);
      } else if (trick && trick.angle) {
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
