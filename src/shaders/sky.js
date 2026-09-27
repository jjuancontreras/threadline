// Sky dome: dusk → night gradient (story) or a full day/night cycle (free mode): blue day sky
// with a sun disc and golden sunrise/sunset band, a drifting cloud deck lit by the sun by day and
// by the city at night, stars in the gaps, a hazy moon. Cloud fbm only runs above the horizon.
import * as THREE from 'three';

const vertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const fragment = /* glsl */ `
  uniform float uNight;
  uniform float uDay;
  uniform float uGolden;
  uniform vec3 uSunDir;
  uniform float uTime;
  uniform vec3 uMoonDir;
  uniform float uClouds;
  varying vec3 vDir;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }
  void main() {
    vec3 d = normalize(vDir);
    float e = clamp(d.y, -0.2, 1.0);
    vec3 duskTop = vec3(0.05, 0.045, 0.12);
    vec3 duskMid = vec3(0.26, 0.1, 0.16);
    vec3 duskLow = vec3(0.62, 0.26, 0.12);
    vec3 nightTop = vec3(0.002, 0.003, 0.008);
    vec3 nightMid = vec3(0.008, 0.011, 0.024);
    vec3 nightLow = vec3(0.085, 0.045, 0.055); // sodium light pollution
    vec3 top = mix(duskTop, nightTop, uNight);
    vec3 mid = mix(duskMid, nightMid, uNight);
    vec3 low = mix(duskLow, nightLow, uNight);
    vec3 col = mix(low, mid, smoothstep(0.0, 0.16, e));
    col = mix(col, top, smoothstep(0.14, 0.65, e));
    // daylight: hazy horizon to deep blue zenith, warmer and pinker toward the sun at golden hour
    float sunDot = max(dot(d, uSunDir), 0.0);
    vec3 dayCol = mix(vec3(0.62, 0.7, 0.8), vec3(0.16, 0.34, 0.68), smoothstep(-0.02, 0.55, e));
    vec3 goldLow = mix(vec3(0.95, 0.46, 0.2), vec3(1.0, 0.72, 0.4), sunDot);
    vec3 goldCol = mix(goldLow, vec3(0.3, 0.3, 0.55), smoothstep(0.0, 0.5, e));
    col = mix(col, goldCol, uGolden * (1.0 - uDay * 0.6));
    col = mix(col, dayCol, uDay);
    col += vec3(1.0, 0.75, 0.45) * pow(sunDot, 12.0) * (0.25 * uDay + 0.5 * uGolden); // halo

    float cover = 0.0;
    if (e > 0.0 && uClouds > 0.5) {
      vec2 uv = d.xz / (d.y + 0.12) * 1.6 + vec2(uTime * 0.006, uTime * 0.002);
      float c = fbm(uv);
      cover = smoothstep(0.42, 0.78, c) * smoothstep(0.0, 0.12, e);
      vec3 under = mix(vec3(0.34, 0.16, 0.1), vec3(0.075, 0.045, 0.05), uNight); // lit by city / sunset
      vec3 cloud = mix(under, vec3(0.02, 0.022, 0.035), smoothstep(0.1, 0.7, e));
      vec3 dayCloud = mix(vec3(0.72, 0.74, 0.8), vec3(0.95, 0.95, 0.97), c) + vec3(0.3, 0.2, 0.1) * pow(sunDot, 4.0);
      cloud = mix(cloud, mix(vec3(0.9, 0.5, 0.35), dayCloud, uDay), max(uDay, uGolden * 0.8));
      col = mix(col, cloud * (0.7 + 0.5 * c), cover * 0.85);
    }
    // stars only through the gaps
    vec3 cell = floor(d * 280.0);
    float s = hash3(cell);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + s * 50.0);
    col += step(0.9975, s) * smoothstep(0.08, 0.35, e) * uNight * (1.0 - uDay) * tw * (1.0 - cover) * vec3(0.8, 0.85, 1.0) * 0.8;
    // sun disc
    col += smoothstep(0.9986, 0.9992, sunDot) * vec3(2.4, 2.1, 1.7) * max(uDay, uGolden) * (1.0 - cover * 0.6) * step(-0.02, uSunDir.y);
    // moon, softened by cloud
    float m = dot(d, normalize(uMoonDir));
    col += smoothstep(0.9993, 0.9996, m) * vec3(1.1, 1.05, 0.95) * (0.3 + 0.7 * uNight) * (1.0 - cover * 0.7) * (1.0 - uDay * 0.8);
    col += pow(max(m, 0.0), 90.0) * vec3(0.14, 0.16, 0.22) * uNight;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSkyMaterial(shared, clouds = true) {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uNight: shared.uNight,
      uDay: shared.uDay,
      uGolden: shared.uGolden,
      uSunDir: shared.uSunDir,
      uTime: shared.uTime,
      uMoonDir: shared.uMoonDir,
      uClouds: { value: clouds ? 1 : 0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
}

const FOG = {
  dusk: new THREE.Color(0.2, 0.11, 0.12),
  night: new THREE.Color(0.02, 0.021, 0.034),
  golden: new THREE.Color(0.55, 0.32, 0.22),
  day: new THREE.Color(0.42, 0.49, 0.58),
};

/** Horizon fog colour that matches the sky's low band (night factor, plus daylight/golden hour). */
export function fogColorFor(night, target, day = 0, golden = 0) {
  target.copy(FOG.dusk).lerp(FOG.night, night);
  target.lerp(FOG.golden, golden * (1 - day * 0.6));
  return target.lerp(FOG.day, day);
}
