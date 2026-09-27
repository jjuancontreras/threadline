// Street traffic: instanced cars (body, cabin, head/tail lights) driven by the street-life
// simulation (car following + signalled crossings), plus additive headlight pools and brake lights.
import * as THREE from 'three';
import { rng } from '../core/math.js';
import { mergeSimple } from './city.js';
import { createTrafficSim } from './streetSim.js';

const PAINTS = [
  [0.05, 0.05, 0.06], [0.12, 0.12, 0.13], [0.35, 0.36, 0.38], [0.02, 0.03, 0.06],
  [0.28, 0.03, 0.03], [0.05, 0.08, 0.2], [0.55, 0.55, 0.56], [0.08, 0.06, 0.05],
];

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
  attribute float aBrake;
  varying float vKind;
  varying float vBrake;
  varying vec3 vPaint;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vKind = aKind;
    vBrake = aBrake;
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
  varying float vBrake;
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
    else col = vec3(2.6, 0.08, 0.05) * (1.0 + vBrake * 1.8); // brake lights flare
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

export function createTraffic(requested, shared) {
  const r = rng(2024);
  const sim = createTrafficSim(requested);
  const { cars } = sim;
  const count = cars.length;
  const brake = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  brake.setUsage(THREE.DynamicDrawUsage);
  const paint = new Float32Array(count * 3);
  cars.forEach((_, i) => paint.set(PAINTS[Math.floor(r() * PAINTS.length)], i * 3));

  const geo = carGeometry();
  geo.setAttribute('aPaint', new THREE.InstancedBufferAttribute(paint, 3));
  geo.setAttribute('aBrake', brake);
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
  let clock = 0;

  let active = count;
  return {
    group,
    /** Keep only a fraction of the cars (adaptive-quality floor). */
    setDensity(k) {
      active = Math.max(1, Math.round(count * k));
      bodies.count = active;
      pools.count = active;
    },
    /** Advance the simulation by dt seconds (the whole fleet keeps moving; only `active` are drawn). */
    update(dt) {
      clock += dt;
      sim.step(dt, clock);
      for (let i = 0; i < active; i++) {
        const [x, z, yaw] = sim.pose(cars[i]);
        m.makeRotationY(yaw).setPosition(x, 0, z);
        bodies.setMatrixAt(i, m);
        pools.setMatrixAt(i, m);
        brake.array[i] = cars[i].braking;
      }
      bodies.instanceMatrix.needsUpdate = true;
      pools.instanceMatrix.needsUpdate = true;
      brake.needsUpdate = true;
    },
    /** Signal clock (seconds) so pedestrians can share the same cycle. */
    get clock() {
      return clock;
    },
  };
}
