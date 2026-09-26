// Luminous neon-red energy tethers: Verlet rope chain rendered as a camera-facing
// ribbon with a hot white core and soft falloff, picked up by the bloom pass.
import * as THREE from 'three';
import { createRope, stepRope, vibrate } from '../physics/rope.js';

const SEGMENTS = 18;
const POINTS = SEGMENTS + 1;

const material = () =>
  new THREE.ShaderMaterial({
    uniforms: { uIntensity: { value: 1 }, uStrain: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSide;
      attribute float aAlong;
      varying float vSide;
      varying float vAlong;
      void main() {
        vSide = aSide;
        vAlong = aAlong;
        gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      uniform float uStrain;
      uniform float uTime;
      varying float vSide;
      varying float vAlong;
      void main() {
        float d = abs(vSide);
        float core = smoothstep(0.35, 0.0, d);
        float halo = pow(1.0 - d, 2.5);
        float pulse = 0.75 + 0.25 * sin(vAlong * 40.0 - uTime * 18.0);
        vec3 neon = vec3(1.0, 0.07, 0.04);
        vec3 hot = mix(neon, vec3(1.0, 0.75, 0.55), uStrain * 0.6);
        vec3 col = hot * halo * 2.4 * pulse + mix(vec3(1.0, 0.35, 0.28), vec3(1.0, 0.85, 0.7), uStrain) * core * (0.9 + uStrain * 1.2);
        gl_FragColor = vec4(col * uIntensity, halo);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

function createRibbon() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(POINTS * 2 * 3);
  const side = new Float32Array(POINTS * 2);
  const along = new Float32Array(POINTS * 2);
  const index = [];
  for (let i = 0; i < POINTS; i++) {
    side[i * 2] = -1;
    side[i * 2 + 1] = 1;
    along[i * 2] = along[i * 2 + 1] = i / SEGMENTS;
    if (i < SEGMENTS) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, material());
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}

const _t = new THREE.Vector3();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _p = new THREE.Vector3();

function writeRibbon(mesh, rope, camera) {
  const pos = mesh.geometry.attributes.position.array;
  const src = rope.pos;
  for (let i = 0; i < POINTS; i++) {
    const a = Math.max(i - 1, 0) * 3;
    const b = Math.min(i + 1, SEGMENTS) * 3;
    _t.set(src[b] - src[a], src[b + 1] - src[a + 1], src[b + 2] - src[a + 2]).normalize();
    _p.set(src[i * 3], src[i * 3 + 1], src[i * 3 + 2]);
    _v.copy(camera.position).sub(_p);
    const dist = _v.length();
    _n.crossVectors(_t, _v).normalize();
    const w = Math.max(0.12, dist * 0.0042);
    for (let s = 0; s < 2; s++) {
      const k = (i * 2 + s) * 3;
      const sign = s === 0 ? -1 : 1;
      pos[k] = _p.x + _n.x * w * sign;
      pos[k + 1] = _p.y + _n.y * w * sign;
      pos[k + 2] = _p.z + _n.z * w * sign;
    }
  }
  mesh.geometry.attributes.position.needsUpdate = true;
}

export function createTethers(count = 8) {
  const group = new THREE.Group();
  const items = Array.from({ length: count }, () => {
    const mesh = createRibbon();
    group.add(mesh);
    return { mesh, rope: createRope(SEGMENTS), active: false };
  });
  const tip = [0, 0, 0];
  return {
    group,
    /** Begin a frame: every tether not updated this frame will be hidden. */
    begin() {
      for (const it of items) it.active = false;
    },
    /**
     * Draw tether i between a (hand) and b (anchor).
     * @param {{extend?:number, strain?:number, slack?:number, time?:number, intensity?:number}} o
     */
    draw(i, a, b, dt, camera, o = {}) {
      const it = items[i];
      if (!it) return;
      const ext = o.extend ?? 1;
      for (let k = 0; k < 3; k++) tip[k] = a[k] + (b[k] - a[k]) * ext;
      if (!it.mesh.visible) it.rope.ready = false;
      stepRope(it.rope, a, tip, Math.min(dt, 1 / 30) || 1 / 60, o.slack ?? 1.0, 6, 9.8);
      if (o.strain) vibrate(it.rope, o.strain * 0.08, o.time ?? 0);
      writeRibbon(it.mesh, it.rope, camera);
      const u = it.mesh.material.uniforms;
      u.uStrain.value = o.strain ?? 0;
      u.uTime.value = o.time ?? 0;
      u.uIntensity.value = o.intensity ?? 1;
      it.mesh.visible = true;
      it.active = true;
    },
    end() {
      for (const it of items) if (!it.active) it.mesh.visible = false;
    },
  };
}
