// Street plane: wet asphalt with puddles, lane markings, crossings and sodium lamp pools.
// Street lines follow the city's block grid (see STREETS in core/layout.js).
import * as THREE from 'three';
import { STREETS } from '../core/layout.js';

const vertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragment = /* glsl */ `
  uniform float uNight;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vWorld;
  const float PERIOD = ${STREETS.period.toFixed(1)};
  const vec2 OFFSET = vec2(${STREETS.offsetX.toFixed(1)}, ${STREETS.offsetZ.toFixed(1)});
  const float HALF = ${STREETS.halfWidth.toFixed(1)};

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  // distance to the nearest street centre-line on one axis
  float lineDist(float c, float offset) { return abs(fract((c - offset) / PERIOD + 0.5) - 0.5) * PERIOD; }

  void main() {
    vec2 p = vWorld.xz;
    float dx = lineDist(p.x, OFFSET.x);
    float dz = lineDist(p.y, OFFSET.y);
    float avenue = 1.0 - smoothstep(19.0, 20.5, abs(p.x));
    float roadX = max(1.0 - smoothstep(HALF, HALF + 0.4, dx), avenue); // road running along z
    float roadZ = 1.0 - smoothstep(HALF, HALF + 0.4, dz);                // road running along x
    float road = max(roadX, roadZ);
    float kerb = (1.0 - road) * max(1.0 - smoothstep(HALF + 0.4, HALF + 3.2, dx), 1.0 - smoothstep(HALF + 0.4, HALF + 3.2, dz));

    float grit = noise(p * 1.7) * 0.5 + noise(p * 7.3) * 0.25;
    vec3 asphalt = vec3(0.012, 0.012, 0.014) * (0.8 + grit * 0.5);
    vec3 pavement = vec3(0.03, 0.029, 0.03) * (0.85 + grit * 0.3);
    vec3 roof = vec3(0.008, 0.008, 0.01);
    vec3 col = mix(roof, pavement, kerb);
    col = mix(col, asphalt, road);

    // lane markings: centre dashes and zebra crossings near intersections
    float dashZ = step(0.55, fract(p.y / 6.0)) * (1.0 - smoothstep(0.1, 0.18, dx)) * roadX * (1.0 - avenue);
    float dashX = step(0.55, fract(p.x / 6.0)) * (1.0 - smoothstep(0.1, 0.18, dz)) * roadZ;
    float aveLine = avenue * (1.0 - smoothstep(0.08, 0.16, abs(abs(p.x) - 10.25))) * step(0.5, fract(p.y / 5.0));
    float inter = roadX * roadZ;
    float zebra = (1.0 - inter) * step(0.5, fract((p.x + p.y) / 1.2)) *
      (roadX * (1.0 - smoothstep(HALF + 1.0, HALF + 1.3, dz)) * step(HALF, dz) + roadZ * (1.0 - smoothstep(HALF + 1.0, HALF + 1.3, dx)) * step(HALF, dx));
    col += vec3(0.16, 0.15, 0.13) * max(max(dashZ, dashX), max(aveLine, zebra)) * 0.35;

    // wet asphalt: puddles mirror the (fogged) sky and pick up warm streetlight pools
    float wet = smoothstep(0.52, 0.7, noise(p * 0.08) * 0.7 + noise(p * 0.5) * 0.3) * road;
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - clamp(v.y, 0.0, 1.0), 5.0);
    float lampAlong = 1.0 - smoothstep(0.0, 9.0, abs(fract(p.y / 23.0) - 0.5) * 23.0);
    float lampAcross = 1.0 - smoothstep(0.0, 9.0, abs(fract(p.x / 23.0) - 0.5) * 23.0);
    float lamps = (lampAlong * max(roadX, kerb) + lampAcross * max(roadZ, kerb)) * uNight;
    vec3 sodium = vec3(0.9, 0.48, 0.16);
    col += sodium * lamps * (0.05 + wet * 0.12);
    col = mix(col, uFogColor * 1.6 + sodium * lamps * 0.2, wet * (0.25 + fres * 0.6));

    float depth = length(vWorld - cameraPosition);
    float fog = 1.0 - exp(-pow(depth * uFogDensity, 2.0));
    gl_FragColor = vec4(mix(col, uFogColor, clamp(fog, 0.0, 1.0)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createGroundMaterial(shared) {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: { uNight: shared.uNight, uFogColor: shared.uFogColor, uFogDensity: shared.uFogDensity },
  });
}
