// Street traffic: instanced cars (body, cabin, head/tail lights) driving the street grid,
// plus additive headlight pools on the asphalt. One matrix update per car per frame.
import * as THREE from 'three';
import { rng } from '../core/math.js';
import { mergeSimple } from './city.js';
import { STREETS } from '../core/layout.js';

const PAINTS = [
  [0.05, 0.05, 0.06], [0.12, 0.12, 0.13], [0.35, 0.36, 0.38], [0.02, 0.03, 0.06],
  [0.28, 0.03, 0.03], [0.05, 0.08, 0.2], [0.55, 0.55, 0.56], [0.08, 0.06, 0.05],
];

function lanes() {
  const out = [];
  const { avenueLanes, crossZ, alongX, halfLane, extentX, extentZ } = STREETS;
  for (const [x, dir] of avenueLanes) out.push({ axis: 'z', c: x, dir, min: extentZ[0], max: extentZ[1] });
  for (const z of crossZ) for (const dir of [-1, 1]) out.push({ axis: 'x', c: z + dir * halfLane, dir, min: extentX[0], max: extentX[1] });
  for (const x of alongX) for (const dir of [-1, 1]) out.push({ axis: 'z', c: x - dir * halfLane, dir, min: extentZ[0], max: extentZ[1] });
  return out;
}

function carGeometry() {
  const parts = [
    [new THREE.BoxGeometry(4.4, 0.9, 1.9).translate(0, 0.75, 0), 0],
    [new THREE.BoxGeometry(2.3, 0.7, 1.7).translate(-0.25, 1.5, 0), 1],
    [new THREE.BoxGeometry(0.08, 0.2, 0.42).translate(2.21, 0.85, 0.6), 2],
    [new THREE.BoxGeometry(0.08, 0.2, 0.42).translate(2.21, 0.85, -0.6), 2],
    [new THREE.BoxGeometry(0.08, 0.16, 0.5).translate(-2.21, 0.95, 0.62), 3],
    [new THREE.BoxGeometry(0.08, 0.16, 0.5).translate(-2.21, 0.95, -0.62), 3],
  ];
  const geo = mergeSimple(parts.map(([g]) => g));
  const kind = [];
  parts.forEach(([g, k]) => {
    const n = (g.index ? g.index.count : g.attributes.position.count);
    for (let i = 0; i < n; i++) kind.push(k);
  });
  geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  return geo;
}

const carVertex = /* glsl */ `
  attribute float aKind;
  attribute vec3 aPaint;
  varying float vKind;
  varying vec3 vPaint;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vKind = aKind;
    vPaint = aPaint;
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const carFragment = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying float vKind;
  varying vec3 vPaint;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
    vec3 col;
    if (vKind < 0.5) col = vPaint * (0.1 + 0.25 * max(n.y, 0.0)) + vec3(0.12, 0.1, 0.14) * fres * 0.6;
    else if (vKind < 1.5) col = vec3(0.01, 0.012, 0.018) + vec3(0.25, 0.2, 0.3) * fres;
    else if (vKind < 2.5) col = vec3(3.2, 2.9, 2.4);
    else col = vec3(2.6, 0.08, 0.05);
    float depth = length(vWorld - cameraPosition);
    float fog = 1.0 - exp(-pow(depth * uFogDensity, 2.0));
    gl_FragColor = vec4(mix(col, uFogColor, clamp(fog, 0.0, 1.0)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const poolFragment = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    // cone of light ahead of the car (uv.x along the road, uv.y across)
    float along = vUv.x;
    float across = abs(vUv.y - 0.5) * 2.0;
    float cone = smoothstep(1.0, 0.0, across / (0.35 + along * 0.65)) * (1.0 - along) * smoothstep(0.0, 0.08, along);
    float depth = length(vWorld - cameraPosition);
    float fog = 1.0 - exp(-pow(depth * uFogDensity, 2.0));
    gl_FragColor = vec4(vec3(1.0, 0.85, 0.62) * cone * 0.32 * (1.0 - fog), 1.0);
  }
`;

export function createTraffic(count, shared) {
  const r = rng(2024);
  const all = lanes();
  const cars = Array.from({ length: count }, () => {
    const lane = all[Math.floor(r() * all.length)];
    return { lane, s0: lane.min + r() * (lane.max - lane.min), v: 7 + r() * 9 };
  });
  const paint = new Float32Array(count * 3);
  cars.forEach((_, i) => paint.set(PAINTS[Math.floor(r() * PAINTS.length)], i * 3));

  const geo = carGeometry();
  geo.setAttribute('aPaint', new THREE.InstancedBufferAttribute(paint, 3));
  const uniforms = { uFogColor: shared.uFogColor, uFogDensity: shared.uFogDensity };
  const bodies = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({ vertexShader: carVertex, fragmentShader: carFragment, uniforms }), count);
  const poolGeo = new THREE.PlaneGeometry(16, 7).rotateX(-Math.PI / 2).translate(10.2, 0.06, 0);
  const pools = new THREE.InstancedMesh(
    poolGeo,
    new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vWorld; void main(){ vUv = uv; vec4 w = modelMatrix * instanceMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: poolFragment,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    count,
  );
  bodies.frustumCulled = false;
  pools.frustumCulled = false;
  const group = new THREE.Group();
  group.add(bodies, pools);
  const m = new THREE.Matrix4();
  const rot = new THREE.Matrix4();

  return {
    group,
    update(time) {
      for (let i = 0; i < count; i++) {
        const c = cars[i];
        const L = c.lane;
        const span = L.max - L.min;
        const s = L.min + ((((c.s0 - L.min + c.v * time * L.dir) % span) + span) % span);
        const yaw = L.axis === 'x' ? (L.dir > 0 ? 0 : Math.PI) : L.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        rot.makeRotationY(yaw);
        m.copy(rot).setPosition(L.axis === 'x' ? s : L.c, 0, L.axis === 'x' ? L.c : s);
        bodies.setMatrixAt(i, m);
        pools.setMatrixAt(i, m);
      }
      bodies.instanceMatrix.needsUpdate = true;
      pools.instanceMatrix.needsUpdate = true;
    },
  };
}
