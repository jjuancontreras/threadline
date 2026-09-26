// Parametric particle bursts (dust shockwave, sparks) and instanced debris.
// Motion is a closed-form function of burst time, so scrubbing backwards works.
import * as THREE from 'three';
import { rng } from '../core/math.js';

const KINDS = {
  dust: { color: [0.16, 0.14, 0.13], size: 3.2, gravity: -0.6, drag: 1.4, blending: THREE.NormalBlending, life: 4.5, opacity: 0.32 },
  sparks: { color: [3.0, 1.6, 0.5], size: 0.22, gravity: -14, drag: 0.5, blending: THREE.AdditiveBlending, life: 1.6, opacity: 1 },
  embers: { color: [2.9, 0.35, 0.18], size: 0.16, gravity: -6, drag: 0.8, blending: THREE.AdditiveBlending, life: 1.2, opacity: 1 },
};

const vertex = /* glsl */ `
  attribute vec3 aVel;
  attribute float aSeed;
  uniform float uT;
  uniform float uGravity;
  uniform float uDrag;
  uniform float uSize;
  uniform float uLife;
  uniform float uPixel;
  uniform float uGrow;
  varying float vFade;
  void main() {
    float t = max(uT - aSeed * 0.15, 0.0);
    float k = (1.0 - exp(-uDrag * t)) / uDrag;
    vec3 p = position + aVel * k + vec3(0.0, 0.5 * uGravity * t * t, 0.0);
    p.y = max(p.y, 0.3);
    float life = t / (uLife * (0.6 + aSeed * 0.8));
    vFade = (1.0 - smoothstep(0.55, 1.0, life)) * step(0.0001, uT) * step(life, 1.0);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uSize * uPixel * (0.5 + aSeed) * (1.0 + life * uGrow) / max(-mv.z, 1.0), 1.0, 64.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d) * vFade * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

/**
 * @param {'dust'|'sparks'|'embers'} kind
 * @param {number} count
 * @param {{ring?:boolean, speed?:number, dir?:number[], spread?:number, seed?:number}} o
 */
export function createBurst(kind, count, o = {}) {
  const K = KINDS[kind];
  const r = rng(o.seed ?? 7);
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const speed = o.speed ?? 20;
  const dir = o.dir ?? [0, 1, 0];
  const spread = o.spread ?? 1;
  for (let i = 0; i < count; i++) {
    let vx;
    let vy;
    let vz;
    if (o.ring) {
      const a = r() * Math.PI * 2;
      const s = speed * (0.6 + r() * 0.6);
      vx = Math.cos(a) * s;
      vz = Math.sin(a) * s;
      vy = r() * speed * 0.18;
    } else {
      vx = dir[0] * speed + (r() - 0.5) * speed * spread;
      vy = dir[1] * speed + (r() - 0.5) * speed * spread;
      vz = dir[2] * speed + (r() - 0.5) * speed * spread;
    }
    vel.set([vx, vy, vz], i * 3);
    seed[i] = r();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uT: { value: 0 },
      uGravity: { value: K.gravity },
      uDrag: { value: K.drag },
      uSize: { value: K.size },
      uLife: { value: K.life },
      uPixel: o.pixel || { value: 600 },
      uGrow: { value: kind === 'dust' ? 2.5 : 0.2 },
      uColor: { value: new THREE.Color(...K.color) },
      uOpacity: { value: K.opacity },
    },
    transparent: true,
    depthWrite: false,
    blending: K.blending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  let lastOrigin = '';
  return {
    points,
    /** Place burst origin and set time since burst (<=0 hides it). */
    set(origin, t) {
      points.position.set(0, 0, 0);
      const key = origin.join(',');
      if (key !== lastOrigin) {
        lastOrigin = key;
        const arr = geo.attributes.position.array;
        for (let i = 0; i < count; i++) arr.set(origin, i * 3);
        geo.attributes.position.needsUpdate = true;
      }
      mat.uniforms.uT.value = Math.max(t, 0);
      points.visible = t > 0 && t < K.life * 1.6;
    },
  };
}

/** Chunky debris pieces with closed-form ballistic motion + tumbling. */
export function createDebris(count, color = 0x4a4f58) {
  const r = rng(31);
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.4 }),
    count,
  );
  mesh.frustumCulled = false;
  const pieces = Array.from({ length: count }, () => ({
    v: [(r() - 0.5) * 30, 6 + r() * 18, (r() - 0.5) * 30],
    s: 0.2 + r() * 0.9,
    spin: [r() * 8, r() * 8, r() * 8],
  }));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  mesh.visible = false;
  return {
    mesh,
    set(origin, t) {
      mesh.visible = t > 0 && t < 8;
      if (!mesh.visible) return;
      pieces.forEach((pc, i) => {
        const y = origin[1] + pc.v[1] * t - 9 * t * t;
        p.set(origin[0] + pc.v[0] * t, Math.max(y, pc.s * 0.5), origin[2] + pc.v[2] * t);
        e.set(pc.spin[0] * t, pc.spin[1] * t, pc.spin[2] * t);
        q.setFromEuler(e);
        sc.set(pc.s, pc.s * 0.6, pc.s * 1.4);
        mesh.setMatrixAt(i, m.compose(p, q, sc));
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
