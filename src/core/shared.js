// Uniforms shared across custom materials, plus a tiny dynamic-light slot allocator.
import * as THREE from 'three';
import { MAX_LIGHTS } from '../shaders/tower.js';

export function createShared() {
  return {
    uNight: { value: 0 }, // artificial light on (windows, lamps)
    uDay: { value: 0 }, // daylight (free-mode day/night cycle; 0 throughout the story)
    uGolden: { value: 0 }, // sunrise / sunset warmth
    uSunDir: { value: new THREE.Vector3(0.3, -0.8, -0.5).normalize() },
    uTime: { value: 0 },
    uFogColor: { value: new THREE.Color(0.1, 0.08, 0.12) },
    uFogDensity: { value: 0.0019 },
    uMoonDir: { value: new THREE.Vector3(-0.35, 0.55, -0.75).normalize() },
    uLights: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uLightColors: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
  };
}

/** Named light slots: 0-2 train cars, 3 sensor eye, 4 hero/tether, 5 impact flash. */
export const LIGHT = { train0: 0, train1: 1, train2: 2, eye: 3, hero: 4, flash: 5 };

export function setLight(shared, slot, pos, radius, color, intensity = 1) {
  shared.uLights.value[slot].set(pos[0], pos[1], pos[2], radius);
  shared.uLightColors.value[slot].setRGB(color[0] * intensity, color[1] * intensity, color[2] * intensity);
}

export function clearLight(shared, slot) {
  shared.uLights.value[slot].w = 0;
}
