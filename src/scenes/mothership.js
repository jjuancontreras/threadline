// The carrier: a city-sized ship that arrives after a twinkle in the sky, opens bay doors
// and drops GANTRY plus a squad of differently-coloured GANTRY units onto the rooftops.
import * as THREE from 'three';
import { createGantryLite, SQUAD_COLORS } from '../characters/gantryLite.js';
import { easeOutCubic, easeInCubic, clamp, lerp } from '../core/math.js';

export const SHIP = { y: 330, center: [0, 0, -560], far: [60, 860, -1580], halfX: 430, halfZ: 300 };

const hullVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const hullFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uShipPos;
  varying vec3 vWorld;
  varying vec3 vNormal;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  void main() {
    vec3 n = normalize(vNormal);
    vec2 q = (vWorld.xz - uShipPos.xz);
    vec2 panel = abs(fract(q / vec2(22.0, 14.0)) - 0.5);
    float seam = 1.0 - smoothstep(0.46, 0.49, max(panel.x, panel.y));
    vec3 col = vec3(0.03, 0.031, 0.04) * (0.7 + 0.3 * seam);
    col += vec3(0.16, 0.08, 0.07) * max(-n.y, 0.0) * 0.08;          // city glow on the underside
    vec2 cell = floor(q / 9.0);
    float h = hash(cell);
    float light = step(0.972, h) * (0.6 + 0.4 * sin(uTime * (1.0 + h * 4.0) + h * 30.0));
    col += light * mix(vec3(1.0, 0.45, 0.2), vec3(0.8, 0.9, 1.0), step(0.993, h)) * 1.6;
    float side = 1.0 - abs(n.y);
    float chase = step(0.82, fract((q.x + q.y) / 36.0 + uTime * 0.08));
    col += vec3(1.0, 0.16, 0.08) * side * (0.18 + chase * 0.9);        // lit hull edge + running chase
    float depth = length(vWorld - cameraPosition);
    float fog = 1.0 - exp(-pow(depth * uFogDensity * 0.55, 2.0));
    gl_FragColor = vec4(mix(col, uFogColor, clamp(fog, 0.0, 0.92)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function buildHull(material) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(SHIP.halfX * 0.9, SHIP.halfX, 38, 6), material);
  slab.scale.z = SHIP.halfZ / SHIP.halfX;
  const spine = new THREE.Mesh(new THREE.BoxGeometry(SHIP.halfX * 1.5, 30, 90), material);
  spine.position.y = 30;
  const keel = new THREE.Mesh(new THREE.BoxGeometry(SHIP.halfX * 1.2, 18, 50), material);
  keel.position.y = -26;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(120, 60, 70), material);
  tower.position.set(-80, 60, -40);
  g.add(slab, spine, keel, tower);
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(26, 32, 140, 10), material);
    pod.rotation.z = Math.PI / 2;
    pod.position.set(side * SHIP.halfX * 0.7, -6, side * 120);
    g.add(pod);
    const engine = new THREE.Mesh(new THREE.CircleGeometry(22, 18), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.5, 0.25) }));
    engine.rotation.y = side * Math.PI / 2;
    engine.position.set(side * (SHIP.halfX * 0.7 + 71), -6, side * 120);
    g.add(engine);
  }
  return g;
}

function buildBay(material, glowMat) {
  const bay = new THREE.Group();
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(28, 36), glowMat);
  glow.rotation.x = Math.PI / 2;
  glow.position.y = -19.5;
  const hinge = new THREE.Group();
  hinge.position.set(-14, -20, 0);
  const door = new THREE.Mesh(new THREE.BoxGeometry(28, 1.5, 36), material);
  door.position.x = 14;
  hinge.add(door);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 12, 1, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffa070, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  bay.add(glow, hinge, beam);
  return { bay, hinge, beam, glowMat };
}

/** Pick rooftops under the hull for the squad drops (spread out, not the hero's roof). */
function pickDropRoofs(towers, avoid, count) {
  const cand = towers.filter(
    (t) => t.h > 35 && t.h < 130 && Math.abs(t.x) < SHIP.halfX * 0.8 && Math.abs(t.z - SHIP.center[2]) < SHIP.halfZ * 0.8 && Math.hypot(t.x - avoid[0], t.z - avoid[2]) > 90,
  );
  const picks = [];
  for (const t of cand.sort((a, b) => b.h - a.h)) {
    if (picks.every((p) => Math.hypot(p.x - t.x, p.z - t.z) > 120)) picks.push(t);
    if (picks.length === count) break;
  }
  return picks.map((t) => [t.x, t.h, t.z]);
}

export function createMothership(shared, towers, mainSpot) {
  const group = new THREE.Group();
  const hullMat = new THREE.ShaderMaterial({
    vertexShader: hullVertex,
    fragmentShader: hullFragment,
    uniforms: { uTime: shared.uTime, uFogColor: shared.uFogColor, uFogDensity: shared.uFogDensity, uShipPos: { value: new THREE.Vector3() } },
  });
  const ship = new THREE.Group();
  ship.add(buildHull(hullMat));
  group.add(ship);

  const roofs = [mainSpot, ...pickDropRoofs(towers, mainSpot, SQUAD_COLORS.length)];
  const bays = roofs.map((r) => {
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), side: THREE.DoubleSide });
    const b = buildBay(hullMat, glowMat);
    b.bay.position.set(r[0] - SHIP.center[0], 0, r[2] - SHIP.center[2]);
    ship.add(b.bay);
    return { ...b, roof: r };
  });
  const dustMat = new THREE.MeshBasicMaterial({ color: 0x8a7a70, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const dustGeo = new THREE.RingGeometry(0.55, 1, 28).rotateX(-Math.PI / 2);
  const squad = roofs.slice(1).map((r, i) => {
    const unit = createGantryLite(SQUAD_COLORS[i]);
    const heading = Math.atan2(-r[0], -500 - r[2]) + (i % 2 ? 0.4 : -0.4);
    unit.rotation.y = heading;
    unit.visible = false;
    const dust = new THREE.Mesh(dustGeo, dustMat.clone());
    dust.position.set(r[0], r[1] + 0.4, r[2]);
    dust.visible = false;
    group.add(unit, dust);
    return { unit, dust, heading };
  });

  const twinkle = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: starTexture(), color: 0xffe2c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }),
  );
  twinkle.position.fromArray(SHIP.far);
  twinkle.scale.setScalar(160);
  group.add(twinkle);
  group.visible = false;

  const shipY = () => ship.position.y;
  return {
    group,
    roofs,
    /**
     * @param s {{arrive:number, twinkle:number, doors:number[], drops:number[], time:number}}
     *   arrive 0..1 approach; doors[i] 0..1 open; drops[i] 0..1 fall (1 = landed on roof).
     */
    update(s) {
      group.visible = s.arrive > 0 || s.twinkle > 0;
      twinkle.material.opacity = s.twinkle;
      twinkle.material.rotation = s.time * 0.8;
      ship.visible = s.arrive > 0;
      const a = easeOutCubic(clamp(s.arrive));
      ship.position.set(
        lerp(SHIP.far[0], SHIP.center[0], a),
        lerp(SHIP.far[1], SHIP.y, a) + Math.sin(s.time * 0.4) * 1.5 * a,
        lerp(SHIP.far[2], SHIP.center[2], a),
      );
      ship.scale.setScalar(lerp(0.35, 1, a));
      hullMat.uniforms.uShipPos.value.copy(ship.position);
      bays.forEach((b, i) => {
        const open = clamp(s.doors[i] ?? 0);
        b.hinge.rotation.z = -open * 1.3;
        b.glowMat.color.setRGB(2.2 * open, 0.55 * open, 0.25 * open);
        const drop = s.drops[i] ?? 0;
        const falling = drop > 0 && drop < 1;
        b.beam.material.opacity = falling ? 0.05 : open * 0.012;
        const len = Math.max(shipY() - 20 - b.roof[1], 1);
        b.beam.scale.set(1, len, 1);
        b.beam.position.y = -20 - len / 2;
        if (i === 0) return; // the hero-facing GANTRY is the full rig, driven by the chapter
        animateUnit(squad[i - 1], b.roof, drop, shipY() - 22, s.time, i);
      });
    },
    /** World-space Y of the bay floor (where GANTRY starts its fall). */
    bayY: () => shipY() - 22,
  };
}

// in drop units (1 unit = the fall duration): how long the landing dust ring and squash last
const DUST_LIFE = 0.9;
const SQUASH_LIFE = 0.3;

/** Fall, landing squash + dust ring, then an idle scan (the units look around the skyline). */
function animateUnit({ unit, dust, heading }, roof, drop, startY, time, i) {
  unit.visible = drop > 0;
  unit.position.set(roof[0], lerp(startY, roof[1], easeInCubic(clamp(drop))), roof[2]);
  const age = drop - 1; // > 0 once landed
  const landed = clamp(age / SQUASH_LIFE);
  unit.scale.set(1.15, 1.15 * (1 - 0.14 * Math.sin(landed * Math.PI)), 1.15);
  unit.rotation.y = heading + Math.sin(time * 0.35 + i * 1.7) * 0.35 * landed;
  const d = age > 0 && age < DUST_LIFE ? age / DUST_LIFE : -1;
  dust.visible = d >= 0;
  if (d < 0) return;
  dust.scale.setScalar(3 + d * 26);
  dust.material.opacity = 0.5 * (1 - d) * (1 - d);
}

function starTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.15, 'rgba(255,220,190,0.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(62, 0, 4, 128);
  g.fillRect(0, 62, 128, 4);
  return new THREE.CanvasTexture(c);
}
