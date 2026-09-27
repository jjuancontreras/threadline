// Ground plane for the whole island: wet asphalt streets with puddles, lane markings, crossings
// and sodium lamp pools (on the block grid, see STREETS), Central Park (lawns, winding paths, the
// Mall, the reservoir), a stone promenade along the shore, and the Hudson / East River beyond it
// (sky reflection, sun glint by day, city-light glitter at night). The shoreline formula mirrors
// landMargin() in core/manhattan.js.
import * as THREE from 'three';
import { STREETS } from '../core/layout.js';
import { ISLAND, PARK } from '../core/manhattan.js';

const f1 = (v) => v.toFixed(1);

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
  uniform float uDay;
  uniform vec3 uSunDir;
  uniform float uTime;
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
  float westAt(float z) { return ${f1(ISLAND.west)} + 22.0 * sin(z * 0.0042) + 9.0 * sin(z * 0.013 + 2.0); }
  float eastAt(float z) { return ${f1(ISLAND.east)} + 26.0 * sin(z * 0.0031 + 1.0) + 8.0 * sin(z * 0.011); }
  float taperK(float z) {
    if (z > ${f1(ISLAND.tipStart)}) return 1.0;
    float t = min(1.0, (${f1(ISLAND.tipStart)} - z) / ${f1(ISLAND.tipStart - ISLAND.tip)});
    return sqrt(max(0.0, 1.0 - t * t));
  }
  float landMargin(vec2 p) {
    float w = westAt(p.y), e = eastAt(p.y);
    float across = (e - w) * 0.5 * taperK(p.y) - abs(p.x - (w + e) * 0.5);
    return min(across, min(p.y - ${f1(ISLAND.tip)}, ${f1(ISLAND.north)} - p.y));
  }

  vec3 riverColor(vec2 p, vec3 v, float depthK) {
    // two scrolling ripple layers perturb a flat normal
    float t = uTime;
    vec2 q = p * 0.09;
    float n1 = noise(q + vec2(t * 0.05, t * 0.03));
    float n2 = noise(q * 2.7 - vec2(t * 0.08, -t * 0.02));
    vec3 n = normalize(vec3((n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.2, 1.0, (n2 - 0.5) * 0.35));
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 deep = mix(vec3(0.004, 0.007, 0.011), vec3(0.03, 0.055, 0.075), uDay);
    vec3 sky = uFogColor * mix(1.3, 1.05, uDay);
    vec3 col = mix(deep, sky, fres);
    vec3 r = reflect(-v, n);
    col += vec3(2.0, 1.7, 1.3) * pow(max(dot(r, uSunDir), 0.0), 220.0) * uDay * step(0.0, uSunDir.y); // sun glint
    // city lights shimmering on the water at night (warm specks stretched toward the viewer)
    float glit = step(0.94, noise(p * vec2(0.9, 0.25) + vec2(0.0, t * 0.4)));
    col += vec3(1.0, 0.62, 0.3) * glit * uNight * 0.35 * (1.0 - depthK);
    return col;
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
    float mark = max(max(dashZ, dashX), max(aveLine, zebra));
    col += vec3(0.16, 0.15, 0.13) * mark * 0.35;
    // daylight: sun-bleached asphalt, pale pavement, crisp paint
    vec3 dayCol = mix(vec3(0.03, 0.03, 0.034), vec3(0.1, 0.097, 0.092) * (0.9 + grit * 0.2), kerb);
    dayCol = mix(dayCol, vec3(0.04, 0.04, 0.044) * (0.85 + grit * 0.35), road) + vec3(0.3, 0.29, 0.26) * mark * 0.55;
    col = mix(col, dayCol * (0.55 + 0.45 * max(uSunDir.y, 0.0)), uDay);

    // wet asphalt: puddles mirror the (fogged) sky and pick up warm streetlight pools
    float wet = smoothstep(0.52, 0.7, noise(p * 0.08) * 0.7 + noise(p * 0.5) * 0.3) * road;
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - clamp(v.y, 0.0, 1.0), 5.0);
    float lampAlong = 1.0 - smoothstep(0.0, 9.0, abs(fract(p.y / 23.0) - 0.5) * 23.0);
    float lampAcross = 1.0 - smoothstep(0.0, 9.0, abs(fract(p.x / 23.0) - 0.5) * 23.0);
    float lamps = (lampAlong * max(roadX, kerb) + lampAcross * max(roadZ, kerb)) * uNight;
    vec3 sodium = vec3(0.9, 0.48, 0.16);
    col += sodium * lamps * (0.05 + wet * 0.12);
    col = mix(col, uFogColor * mix(1.6, 0.45, uDay) + sodium * lamps * 0.2, wet * (0.25 + fres * 0.6));

    float depth = length(vWorld - cameraPosition);
    float depthK = smoothstep(150.0, 900.0, depth);

    // Central Park: lawns and tree shade, winding paths, the Mall, the reservoir
    vec2 park = vec2(${f1(PARK.x[0])}, ${f1(PARK.x[1])});
    vec2 parkZ = vec2(${f1(PARK.z[0])}, ${f1(PARK.z[1])});
    float inPark = step(park.x, p.x) * step(p.x, park.y) * step(parkZ.x, p.y) * step(p.y, parkZ.y);
    if (inPark > 0.5) {
      float g = noise(p * 0.05) * 0.6 + noise(p * 0.4) * 0.4;
      vec3 lawnN = vec3(0.006, 0.011, 0.006) * (0.7 + g * 0.6);
      vec3 lawnD = vec3(0.05, 0.1, 0.035) * (0.7 + g * 0.6) * (0.6 + 0.4 * max(uSunDir.y, 0.0));
      vec3 lawn = mix(lawnN, lawnD, uDay);
      float wind = abs(noise(p * 0.018 + 3.0) - 0.5);
      float path = 1.0 - smoothstep(0.012, 0.03, wind);
      float mall = (1.0 - smoothstep(2.5, 4.0, abs(p.x - (p.y - 330.0) * 0.28))) * step(300.0, p.y) * step(p.y, 440.0);
      float walks = max(path, mall);
      vec3 gravel = mix(vec3(0.03, 0.028, 0.026), vec3(0.14, 0.13, 0.11), uDay);
      col = mix(lawn, gravel, walks);
      col += vec3(0.9, 0.55, 0.25) * walks * uNight * 0.03 * (0.5 + 0.5 * sin(p.y * 0.27)); // path lamps
      vec2 rv = (p - vec2(${f1(PARK.reservoir.x)}, ${f1(PARK.reservoir.z)})) / vec2(${f1(PARK.reservoir.rx)}, ${f1(PARK.reservoir.rz)});
      float res = dot(rv, rv);
      if (res < 1.0) col = riverColor(p, v, depthK);
      else col = mix(col, gravel * 1.2, 1.0 - smoothstep(1.0, 1.08, res)); // the running track
    }

    // shoreline: stone promenade and a foam line, then the rivers — and the far shores beyond
    float shore = landMargin(p);
    float far = max(
      (${f1(ISLAND.jersey)} + 14.0 * sin(p.y * 0.006)) - p.x,
      p.x - (${f1(ISLAND.brooklyn)} + 18.0 * sin(p.y * 0.005 + 2.0))
    );
    if (shore < 12.0 && far < 0.0) {
      vec3 stone = mix(vec3(0.02, 0.02, 0.022), vec3(0.14, 0.135, 0.13), uDay);
      col = mix(col, stone, smoothstep(12.0, 9.0, shore));
      if (shore < 0.0) {
        col = riverColor(p, v, depthK);
        float foam = (1.0 - smoothstep(0.0, 2.5, -shore)) * (0.5 + 0.5 * sin(uTime * 1.3 + p.y * 0.2));
        col += foam * mix(vec3(0.02), vec3(0.25), uDay);
      }
    }
    if (far >= 0.0) {
      // New Jersey / Brooklyn: dark waterfront land with a scatter of lights at night
      float g2 = noise(p * 0.03);
      col = mix(vec3(0.012, 0.012, 0.014), vec3(0.09, 0.09, 0.085), uDay) * (0.8 + g2 * 0.4);
      col += vec3(1.0, 0.6, 0.3) * step(0.965, noise(p * 0.35)) * uNight * 0.25;
      col = mix(col, mix(vec3(0.03), vec3(0.16, 0.155, 0.15), uDay), 1.0 - smoothstep(0.0, 8.0, far)); // waterfront edge
    }

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
    uniforms: { uNight: shared.uNight, uDay: shared.uDay, uSunDir: shared.uSunDir, uTime: shared.uTime, uFogColor: shared.uFogColor, uFogDensity: shared.uFogDensity },
  });
}
