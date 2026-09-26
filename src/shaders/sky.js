// Sky dome: dusk → night gradient, drifting cloud deck lit from below by the city,
// sparse stars in the gaps, a hazy moon. Cloud fbm only runs above the horizon.
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

    float cover = 0.0;
    if (e > 0.0 && uClouds > 0.5) {
      vec2 uv = d.xz / (d.y + 0.12) * 1.6 + vec2(uTime * 0.006, uTime * 0.002);
      float c = fbm(uv);
      cover = smoothstep(0.42, 0.78, c) * smoothstep(0.0, 0.12, e);
      vec3 under = mix(vec3(0.34, 0.16, 0.1), vec3(0.075, 0.045, 0.05), uNight); // lit by city / sunset
      vec3 cloud = mix(under, vec3(0.02, 0.022, 0.035), smoothstep(0.1, 0.7, e));
      col = mix(col, cloud * (0.7 + 0.5 * c), cover * 0.85);
    }
    // stars only through the gaps
    vec3 cell = floor(d * 280.0);
    float s = hash3(cell);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + s * 50.0);
    col += step(0.9975, s) * smoothstep(0.08, 0.35, e) * uNight * tw * (1.0 - cover) * vec3(0.8, 0.85, 1.0) * 0.8;
    // moon, softened by cloud
    float m = dot(d, normalize(uMoonDir));
    col += smoothstep(0.9993, 0.9996, m) * vec3(1.1, 1.05, 0.95) * (0.3 + 0.7 * uNight) * (1.0 - cover * 0.7);
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
    uniforms: { uNight: shared.uNight, uTime: shared.uTime, uMoonDir: shared.uMoonDir, uClouds: { value: clouds ? 1 : 0 } },
    side: THREE.BackSide,
    depthWrite: false,
  });
}

/** Horizon fog colour that matches the sky's low band for a given night factor. */
export function fogColorFor(night, target) {
  const dusk = new THREE.Color(0.2, 0.11, 0.12);
  const nightC = new THREE.Color(0.02, 0.021, 0.034);
  return target.copy(dusk).lerp(nightC, night);
}
