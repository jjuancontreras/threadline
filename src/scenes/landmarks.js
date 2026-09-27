// Set pieces that make the island read as Manhattan: the Empire State Building's mooring mast
// and floodlit crown, the Chrysler Building's stainless terraced crown and spire, One World
// Trade Center's tapered twisting glass shaft, the Brooklyn Bridge over the East River, Hudson
// piers, crowns on tall towers and Central Park's trees. The stacked-box bodies of the landmarks
// are ordinary towers (see core/manhattan.js), so they collide, anchor webs and take wall-runs.
import * as THREE from 'three';
import { LANDMARKS, PARK, ISLAND, onLand } from '../core/manhattan.js';
import { rng } from '../core/math.js';
import { mergeSimple } from './city.js';

const find = (kind) => LANDMARKS.find((l) => l.detail.kind === kind);

/** Faceted glass with a window grid that reflects the (day/night) sky — for One WTC. */
function glassMaterial(shared) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uNight: shared.uNight,
      uDay: shared.uDay,
      uGolden: shared.uGolden,
      uSunDir: shared.uSunDir,
      uFogColor: shared.uFogColor,
      uFogDensity: shared.uFogDensity,
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      uniform float uDay;
      uniform float uGolden;
      uniform vec3 uSunDir;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying vec3 vWorld;
      varying vec3 vNormal;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(cameraPosition - vWorld);
        vec3 r = reflect(-v, n);
        float e = clamp(r.y, -0.2, 1.0);
        vec3 horizon = mix(mix(vec3(0.07, 0.05, 0.07), vec3(0.8, 0.45, 0.28), uGolden), vec3(0.55, 0.62, 0.72), uDay);
        vec3 zenith = mix(vec3(0.008, 0.011, 0.022), vec3(0.16, 0.3, 0.6), uDay);
        vec3 sky = mix(horizon, zenith, smoothstep(-0.05, 0.5, e));
        float fres = 0.08 + 0.92 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
        vec3 col = vec3(0.01, 0.014, 0.02) + sky * fres;
        col += vec3(2.2, 1.9, 1.5) * pow(max(dot(r, uSunDir), 0.0), 120.0) * max(uDay, uGolden);
        // window grid: mullions and a sparse scatter of lit offices at night
        vec2 g = vec2(vWorld.x + vWorld.z, vWorld.y) / vec2(1.6, 3.8);
        vec2 f = fract(g);
        float mull = step(0.9, f.x) + step(0.92, f.y);
        col *= 1.0 - mull * 0.35;
        float lit = step(0.93, hash(floor(g))) * uNight;
        col += vec3(0.9, 0.8, 0.65) * lit * 0.5 * (1.0 - mull);
        float depth = length(vWorld - cameraPosition);
        float fog = 1.0 - exp(-pow(depth * uFogDensity, 2.0));
        gl_FragColor = vec4(mix(col, uFogColor, clamp(fog, 0.0, 1.0)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** Square frustum whose top square is turned 45° against the base: One WTC's twisting facets. */
function twistedShaft(bottomHalf, topHalf, height) {
  const B = [];
  const T = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    B.push([Math.cos(a) * bottomHalf * Math.SQRT2, 0, Math.sin(a) * bottomHalf * Math.SQRT2]);
    const b = (i * Math.PI) / 2;
    T.push([Math.cos(b) * topHalf * Math.SQRT2, height, Math.sin(b) * topHalf * Math.SQRT2]);
  }
  const tris = [];
  for (let i = 0; i < 4; i++) {
    const i1 = (i + 1) % 4;
    tris.push(B[(i + 3) % 4], T[i], B[i]); // base edge, apex up
    tris.push(T[i], T[i1], B[i]); // top edge, apex down
  }
  tris.push(T[0], T[3], T[2], T[0], T[2], T[1]); // roof
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  geo.computeVertexNormals();
  return geo;
}

function buildESB(mats) {
  const lm = find('esbMast');
  const g = new THREE.Group();
  g.position.set(lm.x, lm.detail.base, lm.z);
  const stone = mats.limestone;
  const parts = [
    new THREE.CylinderGeometry(3.4, 4.2, 9, 8).translate(0, 4.5, 0),
    new THREE.CylinderGeometry(2.6, 3.2, 8, 8).translate(0, 13, 0),
    new THREE.SphereGeometry(2.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 17, 0),
  ];
  const mast = new THREE.Mesh(mergeSimple(parts), stone);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.45, 44, 6), mats.steel);
  antenna.position.y = 19.5 + 22;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), mats.beacon);
  tip.position.y = 19.5 + 44;
  // the floodlit crown: glowing shells around the top setbacks, colours cycle at night
  const crownGeo = mergeSimple(
    lm.tiers.slice(3).map(([w, d, h], i) => new THREE.BoxGeometry(w * 2 + 0.6, 2.2, d * 2 + 0.6).translate(0, h - lm.detail.base - 1.2 - i * 0.2, 0)),
  );
  const crown = new THREE.Mesh(crownGeo, mats.esbLights);
  g.add(mast, antenna, tip, crown);
  return g;
}

function buildChrysler(mats) {
  const lm = find('chryslerCrown');
  const g = new THREE.Group();
  g.position.set(lm.x, lm.detail.base, lm.z);
  const hw = lm.detail.halfWidth;
  const terraces = [];
  const windows = [];
  for (let i = 0; i < 6; i++) {
    const k = 1 - i / 6.5;
    const r = hw * Math.SQRT2 * k;
    terraces.push(new THREE.CylinderGeometry(r * 0.86, r, 5, 4, 1).rotateY(Math.PI / 4).translate(0, i * 5 + 2.5, 0));
    // triangular sunburst windows on each face of each terrace
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2;
      const off = hw * k * 0.94;
      windows.push(new THREE.ConeGeometry(1.1 * k + 0.3, 2.6, 3).translate(Math.cos(a) * off, i * 5 + 2.2, Math.sin(a) * off));
    }
  }
  const crown = new THREE.Mesh(mergeSimple(terraces), mats.stainless);
  const lights = new THREE.Mesh(mergeSimple(windows), mats.chryslerLights);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.9, 34, 6), mats.stainless);
  spire.position.y = 30 + 17;
  g.add(crown, lights, spire);
  return g;
}

function buildWTC(mats) {
  const lm = find('wtc');
  const d = lm.detail;
  const g = new THREE.Group();
  g.position.set(lm.x, d.base, lm.z);
  const shaft = new THREE.Mesh(twistedShaft(d.bottomHalf, d.topHalf, d.top - d.base), mats.glass);
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(d.topHalf * 2.2, 3, d.topHalf * 2.2), mats.steel);
  parapet.position.y = d.top - d.base + 1.5;
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.1, 70, 8), mats.steel);
  spire.position.y = d.top - d.base + 35;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.25, 6, 20), mats.whiteLight);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = d.top - d.base + 12;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), mats.whiteLight);
  tip.position.y = d.top - d.base + 70;
  g.add(shaft, parapet, spire, ring, tip);
  return g;
}

/** Brooklyn Bridge: granite gothic towers, deck, catenary main cables, suspenders, lights. */
function buildBridge(mats) {
  const g = new THREE.Group();
  const z = -880;
  const x0 = ISLAND.east - 10;
  const x1 = 1180;
  const deckY = 24;
  const towersX = [610, 1010];
  const deck = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 2.2, 20), mats.steel);
  deck.position.set((x0 + x1) / 2, deckY, z);
  g.add(deck);
  const towerParts = [];
  for (const tx of towersX) {
    for (const s of [-1, 1]) towerParts.push(new THREE.BoxGeometry(9, 84, 7).translate(tx, 42, z + s * 9.5)); // twin piers
    towerParts.push(new THREE.BoxGeometry(9, 14, 26).translate(tx, 77, z)); // top beam over the gothic arches
    towerParts.push(new THREE.BoxGeometry(9, 8, 26).translate(tx, deckY - 6, z)); // below the deck
  }
  g.add(new THREE.Mesh(mergeSimple(towerParts), mats.granite));
  // main cables: anchorage → tower top → sag → tower top → anchorage, both sides
  const cableY = (x) => {
    if (x < towersX[0]) return deckY + ((x - x0) / (towersX[0] - x0)) * (84 - deckY);
    if (x > towersX[1]) return deckY + ((x1 - x) / (x1 - towersX[1])) * (84 - deckY);
    const u = (x - towersX[0]) / (towersX[1] - towersX[0]);
    return 84 - 58 * 4 * u * (1 - u);
  };
  const lamps = [];
  const hangers = [];
  for (const s of [-1, 1]) {
    const pts = [];
    for (let x = x0; x <= x1; x += 10) pts.push(new THREE.Vector3(x, cableY(x), z + s * 9.5));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.45, 5), mats.steel);
    g.add(tube);
    for (let x = x0 + 10; x < x1; x += 10) {
      const y = cableY(x);
      if (y - deckY > 1.5) hangers.push(new THREE.BoxGeometry(0.15, y - deckY, 0.15).translate(x, (y + deckY) / 2, z + s * 9.5));
      if ((x / 10) % 2 === 0) lamps.push(new THREE.SphereGeometry(0.55, 6, 4).translate(x, y + 0.6, z + s * 9.5)); // the "necklace"
    }
  }
  g.add(new THREE.Mesh(mergeSimple(hangers), mats.steel));
  g.add(new THREE.Mesh(mergeSimple(lamps), mats.necklace));
  return g;
}

/** Piers along the Hudson and the lower East River. */
function buildPiers(mats) {
  const parts = [];
  for (let z = -950; z <= 900; z += 70) {
    // walk out from the shoreline until we're in the water, then build the pier from there
    let x = ISLAND.west + 40;
    while (onLand(x, z) && x > ISLAND.west - 60) x -= 4;
    parts.push(new THREE.BoxGeometry(56, 2.4, 14).translate(x - 26, 1.2, z));
    if (z < -300) {
      let e = ISLAND.east - 40;
      while (onLand(e, z) && e < ISLAND.east + 60) e += 4;
      parts.push(new THREE.BoxGeometry(40, 2.4, 12).translate(e + 18, 1.2, z + 30));
    }
  }
  return new THREE.Mesh(mergeSimple(parts), mats.pier);
}

/** Crowns and caps on tall fill towers (visual only): pyramids, stepped caps, spires. */
function buildCrowns(towers, mats) {
  const r = rng(515);
  const pyramids = [];
  const steps = [];
  const spires = [];
  for (const t of towers) {
    if (t.kind || t.h < 85 || r() > 0.32) continue;
    const pick = r();
    if (pick < 0.4) {
      const rad = Math.min(t.w, t.d) * Math.SQRT2 * 0.9;
      pyramids.push(new THREE.ConeGeometry(rad, Math.min(t.w, t.d) * 1.3, 4).rotateY(Math.PI / 4).translate(t.x, t.h + Math.min(t.w, t.d) * 0.65, t.z));
    } else if (pick < 0.75) {
      steps.push(new THREE.BoxGeometry(t.w * 1.3, 4, t.d * 1.3).translate(t.x, t.h + 2, t.z));
      steps.push(new THREE.BoxGeometry(t.w * 0.7, 4, t.d * 0.7).translate(t.x, t.h + 6, t.z));
    } else {
      spires.push(new THREE.CylinderGeometry(0.2, 1.4, 22, 6).translate(t.x, t.h + 11, t.z));
    }
  }
  const out = [];
  if (pyramids.length) out.push(new THREE.Mesh(mergeSimple(pyramids), mats.copper));
  if (steps.length) out.push(new THREE.Mesh(mergeSimple(steps), mats.darkStone));
  if (spires.length) out.push(new THREE.Mesh(mergeSimple(spires), mats.steel));
  return out;
}

/** Central Park trees: instanced trunk + two-lobed canopy, clear of the reservoir. */
function buildTrees(count, mats) {
  const r = rng(808);
  const trunk = new THREE.CylinderGeometry(0.25, 0.4, 3.2, 5).translate(0, 1.6, 0);
  const canopy = mergeSimple([new THREE.IcosahedronGeometry(2.6, 0).translate(0, 4.8, 0), new THREE.IcosahedronGeometry(1.9, 0).translate(0.9, 6.3, 0.4)]);
  const trunks = new THREE.InstancedMesh(trunk, mats.bark, count);
  const leaves = new THREE.InstancedMesh(canopy, mats.leaves, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const res = PARK.reservoir;
  let n = 0;
  for (let tries = 0; n < count && tries < count * 6; tries++) {
    const x = PARK.x[0] + 6 + r() * (PARK.x[1] - PARK.x[0] - 12);
    const z = PARK.z[0] + 6 + r() * (PARK.z[1] - PARK.z[0] - 12);
    if (((x - res.x) / (res.rx + 8)) ** 2 + ((z - res.z) / (res.rz + 8)) ** 2 < 1) continue;
    const s = 0.8 + r() * 0.7;
    m.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(up, r() * 6.28), new THREE.Vector3(s, s * (0.9 + r() * 0.3), s));
    trunks.setMatrixAt(n, m);
    leaves.setMatrixAt(n, m);
    leaves.setColorAt(n, new THREE.Color().setHSL(0.27 + r() * 0.08, 0.45, 0.16 + r() * 0.08));
    n++;
  }
  trunks.count = leaves.count = n;
  trunks.frustumCulled = leaves.frustumCulled = false;
  return [trunks, leaves];
}

/**
 * @param {object[]} towers the full tower list (for crowns)
 * @param {object} shared shared uniforms
 * @param {{tier:string}} quality
 */
export function createLandmarks(towers, shared, quality) {
  const std = (color, roughness, metalness = 0.1, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const mats = {
    limestone: std(0xc4b8a0, 0.8),
    steel: std(0x2a2d33, 0.45, 0.8),
    stainless: std(0xdfe3ea, 0.28, 0.55, { emissive: new THREE.Color(0x22262c) }),
    granite: std(0x8b8175, 0.9),
    pier: std(0x3d3a36, 0.9),
    copper: std(0x3f7d6c, 0.6, 0.4), // verdigris
    darkStone: std(0x3a3b40, 0.85),
    bark: std(0x2b2118, 0.95),
    leaves: std(0xffffff, 0.9),
    glass: glassMaterial(shared),
    beacon: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.2, 0.12) }),
    whiteLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.6) }),
    esbLights: new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) }),
    chryslerLights: new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) }),
    necklace: new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) }),
  };
  const group = new THREE.Group();
  group.add(buildESB(mats), buildChrysler(mats), buildWTC(mats), buildBridge(mats), buildPiers(mats), ...buildCrowns(towers, mats));
  group.add(...buildTrees({ high: 900, medium: 520, low: 220 }[quality.tier] ?? 520, mats));

  // Empire State colour programme: amber, red-white-blue, then white (cycles slowly at night)
  const ESB_COLOURS = [new THREE.Color(1.6, 0.85, 0.25), new THREE.Color(2.2, 0.2, 0.2), new THREE.Color(1.8, 1.8, 2.0), new THREE.Color(0.3, 0.5, 2.2)];
  const tmp = new THREE.Color();
  return {
    group,
    /** Night lighting follows the artificial-light level of the day/night cycle. */
    update(time) {
      const lights = shared.uNight.value;
      const n = ESB_COLOURS.length;
      const k = (((time / 12) % n) + n) % n;
      const i = Math.floor(k);
      tmp.copy(ESB_COLOURS[i]).lerp(ESB_COLOURS[(i + 1) % ESB_COLOURS.length], Math.min(1, (k - i) * 4));
      mats.esbLights.color.copy(tmp).multiplyScalar(0.15 + lights * 0.85);
      mats.chryslerLights.color.setRGB(2.4, 2.2, 1.8).multiplyScalar(lights);
      mats.necklace.color.setRGB(2.6, 2.3, 1.7).multiplyScalar(0.1 + lights * 0.9);
    },
  };
}
