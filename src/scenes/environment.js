// Sky dome, street plane, scene lights and optional rain.
import * as THREE from 'three';
import { createSkyMaterial } from '../shaders/sky.js';
import { createGroundMaterial } from '../shaders/ground.js';

export function createEnvironment(shared, quality) {
  const group = new THREE.Group();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1700, 32, 16), createSkyMaterial(shared, quality.tier !== 'low'));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  group.add(sky);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), createGroundMaterial(shared));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -300);
  group.add(ground);

  const hemi = new THREE.HemisphereLight(0x6a6590, 0x0a0c12, 0.5);
  const moon = new THREE.DirectionalLight(0xa9bddf, 0.9);
  moon.position.copy(shared.uMoonDir.value).multiplyScalar(500);
  const rim = new THREE.DirectionalLight(0xff8a5a, 0.35); // warm city bounce
  rim.position.set(300, 120, 400);
  group.add(hemi, moon, rim);

  const rain = quality.tier === 'high' ? createRain(2200) : quality.tier === 'medium' ? createRain(900) : null;
  if (rain) group.add(rain.mesh);

  return {
    group,
    hemi,
    update(time, cameraPos, night) {
      hemi.intensity = THREE.MathUtils.lerp(0.8, 0.35, night);
      if (rain) rain.update(time, cameraPos);
    },
  };
}

/** Camera-local rain streaks (line segments recycled around the camera). */
function createRain(count) {
  const pos = new Float32Array(count * 6);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    seeds[i * 3] = (Math.random() - 0.5) * 120;
    seeds[i * 3 + 1] = Math.random() * 80;
    seeds[i * 3 + 2] = (Math.random() - 0.5) * 120;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x5f7890, transparent: true, opacity: 0.13, depthWrite: false });
  const mesh = new THREE.LineSegments(geo, mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    update(time, c) {
      for (let i = 0; i < count; i++) {
        const y = ((seeds[i * 3 + 1] - time * 38) % 80 + 80) % 80 - 40;
        const x = c.x + seeds[i * 3] - time * 3;
        const z = c.z + seeds[i * 3 + 2];
        const o = i * 6;
        pos[o] = ((x - c.x + 60) % 120 + 120) % 120 - 60 + c.x;
        pos[o + 1] = c.y + y;
        pos[o + 2] = z;
        pos[o + 3] = pos[o] + 0.25;
        pos[o + 4] = pos[o + 1] + 1.6;
        pos[o + 5] = z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
