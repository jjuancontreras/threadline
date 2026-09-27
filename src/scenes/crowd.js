// Street crowds: instanced low-poly people driven by pedSim.js. The walk/run cycle is done in the
// vertex shader (legs and arms swing about hip/shoulder pivots from a per-person phase), so the
// CPU only uploads a matrix, a phase and a gait amount per person. Some carry umbrellas (it rains).
import * as THREE from 'three';
import { rng } from '../core/math.js';
import { mergeSimple } from './city.js';
import { createPedSim } from './pedSim.js';

const TOPS = [
  [0.09, 0.09, 0.1], [0.16, 0.05, 0.05], [0.05, 0.08, 0.16], [0.22, 0.2, 0.18], [0.05, 0.1, 0.07],
  [0.3, 0.16, 0.06], [0.12, 0.12, 0.14], [0.36, 0.34, 0.3], [0.18, 0.06, 0.14],
];
const BOTTOMS = [[0.04, 0.04, 0.05], [0.06, 0.07, 0.12], [0.1, 0.09, 0.08], [0.02, 0.02, 0.02]];
const UMBRELLA_SHARE = 0.3;

// part kinds: 0 torso, 1 left leg, 2 right leg, 3 head, 4 left arm, 5 right arm, 6 umbrella
function personGeometry() {
  const parts = [
    [new THREE.BoxGeometry(0.24, 0.62, 0.4).translate(0, 1.13, 0), 0],
    [new THREE.BoxGeometry(0.16, 0.82, 0.16).translate(0, 0.41, 0.11), 1],
    [new THREE.BoxGeometry(0.16, 0.82, 0.16).translate(0, 0.41, -0.11), 2],
    [new THREE.BoxGeometry(0.2, 0.24, 0.19).translate(0.01, 1.58, 0), 3],
    [new THREE.BoxGeometry(0.12, 0.6, 0.12).translate(0, 1.12, 0.27), 4],
    [new THREE.BoxGeometry(0.12, 0.6, 0.12).translate(0, 1.12, -0.27), 5],
    [new THREE.ConeGeometry(0.62, 0.26, 8, 1, true).translate(0.12, 2.12, -0.1), 6],
    [new THREE.CylinderGeometry(0.015, 0.015, 0.75, 4).translate(0.12, 1.72, -0.1), 6],
  ];
  const geo = mergeSimple(parts.map(([g]) => g));
  const kind = [];
  parts.forEach(([g, k]) => {
    const n = g.index ? g.index.count : g.attributes.position.count;
    for (let i = 0; i < n; i++) kind.push(k);
  });
  geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  return geo;
}

const vertex = /* glsl */ `
  attribute float aKind;
  attribute float aPhase;
  attribute float aGait;   // 0 standing, ~1 walking, ~2 running
  attribute float aUmb;    // 1 = carries an umbrella
  attribute vec3 aTop;
  attribute vec3 aBottom;
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vWorld;

  // rotate p about the lateral (z) axis through a pivot at height y0
  vec3 swing(vec3 p, float y0, float a) {
    float c = cos(a), s = sin(a);
    vec2 q = vec2(p.x, p.y - y0);
    return vec3(q.x * c - q.y * s, q.x * s + q.y * c + y0, p.z);
  }
  vec3 swingN(vec3 n, float a) {
    float c = cos(a), s = sin(a);
    return vec3(n.x * c - n.y * s, n.x * s + n.y * c, n.z);
  }

  void main() {
    vec3 p = position;
    vec3 n = normal;
    float g = aGait;
    float stride = sin(aPhase) * (0.45 * min(g, 1.0) + 0.25 * max(g - 1.0, 0.0));
    if (aKind > 0.5 && aKind < 2.5) {
      float a = aKind < 1.5 ? stride : -stride;
      p = swing(p, 0.82, a);
      n = swingN(n, a);
    } else if (aKind > 3.5 && aKind < 5.5) {
      // arms swing against the legs; the umbrella hand stays raised
      bool holding = aKind > 4.5 && aUmb > 0.5;
      float a = holding ? 1.25 : (aKind < 4.5 ? -stride : stride) * 0.9;
      p = swing(p, 1.4, a);
      n = swingN(n, a);
    } else if (aKind > 5.5) {
      p *= aUmb; // collapse the umbrella for people without one
    }
    p.y += abs(sin(aPhase)) * 0.045 * min(g, 1.5);
    // lean into a run
    p = swing(p, 0.0, -0.18 * max(g - 1.0, 0.0));

    vColor = aKind < 0.5 || (aKind > 3.5 && aKind < 5.5) ? aTop
      : aKind < 2.5 ? aBottom
      : aKind < 3.5 ? vec3(0.06, 0.045, 0.04)
      : aTop * 0.6 + vec3(0.02);
    vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    vNormal = normalize(mat3(modelMatrix * instanceMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uDay;
  uniform vec3 uSunDir;
  uniform float uFogDensity;
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - abs(dot(n, v)), 3.0);
    // storefront + sodium spill from below/side, cool sky from above
    vec3 col = vColor * (0.4 + 0.28 * max(n.y, 0.0)) + vec3(0.09, 0.05, 0.025) * (1.0 - abs(n.y)) + vec3(0.05, 0.06, 0.09) * fres;
    col = mix(col, vColor * (1.4 + 2.2 * max(dot(n, uSunDir), 0.0) * step(0.0, uSunDir.y) + 0.6 * max(n.y, 0.0)) + vec3(0.1, 0.12, 0.15) * fres, uDay);
    float depth = length(vWorld - cameraPosition);
    float fog = 1.0 - exp(-pow(depth * uFogDensity, 2.0));
    gl_FragColor = vec4(mix(col, uFogColor, clamp(fog, 0.0, 1.0)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * @param {number} count people
 * @param {{uFogColor: {value: THREE.Color}, uFogDensity: {value: number}}} shared
 */
export function createCrowd(count, shared) {
  const r = rng(99);
  const sim = createPedSim(count);
  const { people } = sim;
  const geo = personGeometry();
  const inst = (size, fill) => {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(count * size), size);
    if (fill) people.forEach((p, i) => a.array.set(fill(p, i), i * size));
    return a;
  };
  const phase = inst(1);
  const gait = inst(1);
  phase.setUsage(THREE.DynamicDrawUsage);
  gait.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPhase', phase);
  geo.setAttribute('aGait', gait);
  geo.setAttribute('aUmb', inst(1, () => [r() < UMBRELLA_SHARE ? 1 : 0]));
  geo.setAttribute('aTop', inst(3, () => TOPS[Math.floor(r() * TOPS.length)]));
  geo.setAttribute('aBottom', inst(3, () => BOTTOMS[Math.floor(r() * BOTTOMS.length)]));
  const scale = people.map(() => 0.92 + r() * 0.16);

  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: { uFogColor: shared.uFogColor, uFogDensity: shared.uFogDensity, uDay: shared.uDay, uSunDir: shared.uSunDir } }),
    count,
  );
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  let active = count;

  return {
    group: mesh,
    sim,
    /** Keep only a fraction of the crowd drawn (adaptive-quality floor). */
    setDensity(k) {
      active = Math.max(1, Math.round(count * k));
      mesh.count = active;
    },
    /** Panic everyone near an impact (story cue). */
    scatter(center, radius, seconds) {
      return sim.scatter(center, radius, seconds);
    },
    /** @param dt seconds @param signalClock traffic signal clock so walkers and cars agree */
    update(dt, signalClock) {
      sim.step(dt, signalClock);
      for (let i = 0; i < active; i++) {
        const p = people[i];
        const [x, z] = sim.position(p);
        q.setFromAxisAngle(up, sim.yaw(p));
        m.compose(pos.set(x, 0.02, z), q, scl.setScalar(scale[i]));
        mesh.setMatrixAt(i, m);
        phase.array[i] = p.phase;
        gait.array[i] = p.v / 1.4;
      }
      mesh.instanceMatrix.needsUpdate = true;
      phase.needsUpdate = true;
      gait.needsUpdate = true;
    },
  };
}
