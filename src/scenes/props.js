// Interactive city props: street lamps, rooftop barrel clusters and construction cranes with a
// hanging pipe. Renders them (instanced where it matters) and answers "what can the hero use
// right here?" for the free-mode E action: run through a crane pipe, or whirl round a pole.
import * as THREE from 'three';
import { streetLamps, barrelClusters, craneSites, pipeEnds, CRANE, LAMP } from './propLayout.js';
import { pipeMove, poleMove } from './free/moves.js';
import { rng, vDist } from '../core/math.js';
import { mergeSimple } from './city.js';

export const REACH = { pipe: 16, pole: 4.5 };

function latticeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff';
  g.lineWidth = 5;
  g.strokeRect(2, 2, 60, 60);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(64, 64);
  g.moveTo(64, 0);
  g.lineTo(0, 64);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 8, 64);
  g.fillStyle = '#fff';
  g.fillRect(0, 28, 8, 6);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildLamps(lamps) {
  const pole = new THREE.CylinderGeometry(0.1, 0.16, LAMP.height, 8).translate(0, LAMP.height / 2, 0);
  const arm = new THREE.BoxGeometry(2.4, 0.12, 0.12).translate(1.2, LAMP.height - 0.1, 0);
  const steel = new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.55, metalness: 0.7 });
  const head = new THREE.BoxGeometry(0.9, 0.18, 0.42).translate(2.25, LAMP.height - 0.22, 0);
  const sodium = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.7, 0.6) });
  const poles = new THREE.InstancedMesh(mergeSimple([pole, arm]), steel, lamps.length);
  const heads = new THREE.InstancedMesh(head, sodium, lamps.length);
  const m = new THREE.Matrix4();
  lamps.forEach((l, i) => {
    m.makeRotationY(Math.atan2(-l.arm[1], l.arm[0])).setPosition(l.x, 0, l.z);
    poles.setMatrixAt(i, m);
    heads.setMatrixAt(i, m);
  });
  poles.frustumCulled = heads.frustumCulled = false;
  return [poles, heads];
}

function buildBarrels(clusters) {
  const r = rng(71);
  const list = [];
  for (const c of clusters) {
    for (let i = 0; i < c.n; i++) {
      const a = (i / c.n) * Math.PI * 2 + c.seed * 6;
      const rad = i === 0 ? 0 : 0.95;
      list.push([c.x + Math.cos(a) * rad, c.roof, c.z + Math.sin(a) * rad, r()]);
    }
  }
  const geo = new THREE.CylinderGeometry(0.42, 0.42, 1.2, 12).translate(0, 0.6, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.35 }), Math.max(list.length, 1));
  const colors = [new THREE.Color(0x1f4d8c), new THREE.Color(0x7a2b1c), new THREE.Color(0x9c7a1e), new THREE.Color(0x2f3a2e)];
  const m = new THREE.Matrix4();
  list.forEach(([x, y, z, k], i) => {
    m.makeRotationY(k * 6).setPosition(x, y, z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, colors[Math.floor(k * colors.length)]);
  });
  mesh.count = list.length;
  mesh.frustumCulled = false;
  return mesh;
}

function buildCrane(site, mats) {
  const g = new THREE.Group();
  g.position.set(site.x, site.roof, site.z);
  const lattice = (w, h, d, rx, ry) => {
    const mat = mats.lattice.clone();
    mat.map = mats.lattice.map.clone();
    mat.map.repeat.set(rx, ry);
    mat.map.needsUpdate = true;
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  };
  const mast = lattice(2.2, CRANE.mast, 2.2, 1, CRANE.mast / 2.2);
  mast.position.y = CRANE.mast / 2;
  const top = new THREE.Group();
  top.position.y = CRANE.mast;
  top.rotation.y = -site.yaw;
  const jib = lattice(CRANE.jib, 1.8, 1.6, CRANE.jib / 1.8, 1);
  jib.position.set(CRANE.jib / 2 - 2, 0.9, 0);
  const counter = lattice(14, 1.6, 1.6, 14 / 1.6, 1);
  counter.position.set(-9, 0.8, 0);
  const weight = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), mats.concrete);
  weight.position.set(-14, -0.4, 0);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.4), mats.yellow);
  cab.position.set(1.8, -1.2, 1.9);
  const apex = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 4), mats.yellow);
  apex.position.y = 4.4;
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 1.8), mats.steel);
  trolley.position.set(CRANE.trolley, -0.3, 0);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, CRANE.cable, 5), mats.steel);
  cable.position.set(CRANE.trolley, -CRANE.cable / 2, 0);
  const beacons = [new THREE.Vector3(CRANE.jib - 2.5, 2, 0), new THREE.Vector3(0, 8, 0)].map((p) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mats.beacon);
    b.position.copy(p);
    return b;
  });
  top.add(jib, counter, weight, cab, apex, trolley, cable, ...beacons);
  g.add(mast, top);

  // the pipe hangs in world space (it sways about the cable)
  const pipe = new THREE.Group();
  const outer = new THREE.CylinderGeometry(CRANE.pipeRadius, CRANE.pipeRadius, CRANE.pipeLength, 28, 1, true).rotateZ(Math.PI / 2);
  const inner = outer.clone();
  const lipGeo = new THREE.TorusGeometry(CRANE.pipeRadius, 0.18, 8, 28).rotateY(Math.PI / 2);
  const lips = [-1, 1].map((s) => {
    const lip = new THREE.Mesh(lipGeo, mats.pipeLip);
    lip.position.x = (s * CRANE.pipeLength) / 2;
    return lip;
  });
  pipe.add(new THREE.Mesh(outer, mats.pipe), new THREE.Mesh(inner, mats.pipeInside), ...lips);
  // lifting slings from the hook to the pipe
  for (const s of [-1, 1]) {
    const sling = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6.2, 4), mats.steel);
    sling.position.set(s * 3, CRANE.pipeRadius + 2.6, 0);
    sling.rotation.z = s * 0.55;
    pipe.add(sling);
  }
  return { group: g, pipe };
}

/**
 * @param {object[]} towers
 * @param {{colliders: object[], poles: object[]}} roofs rooftop clutter exported by the city
 */
export function createProps(towers, roofs) {
  const group = new THREE.Group();
  const lamps = streetLamps(towers);
  const clusters = barrelClusters(towers);
  const sites = craneSites(towers);
  group.add(...buildLamps(lamps), buildBarrels(clusters));

  const mats = {
    lattice: new THREE.MeshStandardMaterial({ color: 0xd7a21c, map: latticeTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xd7a21c, roughness: 0.55, metalness: 0.25 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 0.95 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5, metalness: 0.7 }),
    beacon: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.15, 0.1) }),
    pipe: new THREE.MeshStandardMaterial({ color: 0x7d4424, roughness: 0.72, metalness: 0.45 }),
    pipeLip: new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.4, metalness: 0.8 }),
    pipeInside: new THREE.MeshStandardMaterial({
      color: 0x14161b,
      side: THREE.BackSide,
      roughness: 0.5,
      metalness: 0.6,
      emissive: new THREE.Color(1, 0.35, 0.12),
      emissiveMap: (() => {
        const t = ringTexture();
        t.repeat.set(1, CRANE.pipeLength / 3);
        return t;
      })(),
      emissiveIntensity: 1.6,
    }),
  };
  const cranes = sites.map((site) => {
    const c = buildCrane(site, mats);
    group.add(c.group, c.pipe);
    return { site, ...c, sway: 0 };
  });

  const colliders = [
    ...(roofs.colliders || []),
    ...clusters.map((c) => c.collider),
    ...sites.map((s) => ({ x: s.x, z: s.z, w: 1.2, d: 1.2, h: s.roof + CRANE.mast, kind: 'crane' })),
  ];
  const poles = [...lamps, ...(roofs.poles || [])];
  const endsOf = (crane) => pipeEnds(crane.site, crane.sway);

  /** What E does right here, if anything: { kind, label, start(pos, vel) } */
  function actionNear(pos, heading) {
    for (const crane of cranes) {
      const e = endsOf(crane);
      if (Math.min(vDist(pos, e.a), vDist(pos, e.b)) < REACH.pipe) {
        return { kind: 'pipe', label: 'PIPE RUN', start: (p) => pipeMove(p, () => endsOf(crane)) };
      }
    }
    let best = null;
    let bestD = REACH.pole;
    for (const pole of poles) {
      const d = Math.hypot(pos[0] - pole.x, pos[2] - pole.z);
      if (d < bestD && pos[1] > pole.base - 1.5 && pos[1] < pole.top + 1) {
        bestD = d;
        best = pole;
      }
    }
    if (best) return { kind: 'pole', label: best.kind === 'lamp' ? 'LAMP SWING' : 'POLE SWING', start: (p) => poleMove(p, heading, best) };
    return null;
  }

  return {
    group,
    colliders,
    poles,
    cranes: sites,
    actionNear,
    pipeEnds: (i) => endsOf(cranes[i]),
    update(time) {
      for (const c of cranes) {
        c.sway = CRANE.sway * Math.sin(time * 0.35 + c.site.phase);
        const e = endsOf(c);
        c.pipe.position.fromArray(e.center);
        c.pipe.rotation.y = -Math.atan2(e.axis[2], e.axis[0]);
      }
    },
  };
}
