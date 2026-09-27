// Tower material: instanced boxes with a procedural facade — glass curtain walls (fresnel
// sky reflection) or punched-window concrete — sparse warm interiors, distance-faded window
// detail (no far-field sparkle), height fog and up to MAX_LIGHTS dynamic point lights.
import * as THREE from 'three';

export const MAX_LIGHTS = 6;

const vertex = /* glsl */ `
  attribute float aSeed;
  attribute vec3 aTint;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vSeed;
  varying vec3 vTint;
  varying float vHeight;
  void main() {
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    vSeed = aSeed;
    vTint = aTint;
    vHeight = instanceMatrix[1][1];
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = /* glsl */ `
  uniform float uNight;
  uniform float uDay;
  uniform float uGolden;
  uniform vec3 uSunDir;
  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uMoonDir;
  uniform vec4 uLights[${MAX_LIGHTS}];
  uniform vec3 uLightColors[${MAX_LIGHTS}];
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vSeed;
  varying vec3 vTint;
  varying float vHeight;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  // cheap stand-in for the night sky seen in reflections
  vec3 skyReflect(vec3 r) {
    float e = clamp(r.y, -0.2, 1.0);
    vec3 horizon = mix(vec3(0.3, 0.14, 0.12), vec3(0.075, 0.05, 0.07), uNight);
    vec3 zenith = mix(vec3(0.06, 0.05, 0.12), vec3(0.008, 0.011, 0.022), uNight);
    horizon = mix(mix(horizon, vec3(0.8, 0.45, 0.28), uGolden), vec3(0.42, 0.48, 0.56), uDay);
    zenith = mix(zenith, vec3(0.12, 0.24, 0.48), uDay);
    vec3 sky = mix(horizon, zenith, smoothstep(-0.05, 0.5, e));
    float sun = pow(max(dot(r, uSunDir), 0.0), 80.0) * step(0.0, uSunDir.y);
    return sky + vec3(2.5, 2.1, 1.6) * sun * max(uDay, uGolden);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vWorld);
    float depth = length(vWorld - cameraPosition);
    bool roof = n.y > 0.5;
    float glass = step(0.55, fract(vSeed * 7.13)); // ~45% glass curtain walls
    vec3 col;

    float sunLit = max(dot(n, uSunDir), 0.0) * step(-0.05, uSunDir.y);
    if (roof) {
      col = vTint * 0.012 + vec3(0.004, 0.004, 0.006);
      col = mix(col, vTint * (0.06 + 0.24 * sunLit), uDay);
    } else {
      float u = abs(n.x) > 0.5 ? vWorld.z : vWorld.x;
      float hgt = vWorld.y;
      vec2 cellSize = mix(vec2(2.6, 3.7), vec2(1.5, 3.7), glass);
      vec2 cell = vec2(u, hgt) / cellSize;
      vec2 id = floor(cell);
      vec2 f = fract(cell);
      vec2 lo = mix(vec2(0.18, 0.26), vec2(0.06, 0.12), glass);
      vec2 hi = 1.0 - lo;
      float frame = step(lo.x, f.x) * step(f.x, hi.x) * step(lo.y, f.y) * step(f.y, hi.y);

      float face = vSeed * 91.0 + n.x * 3.0 + n.z * 7.0;
      float h = hash(vec3(id, face));
      float run = hash(vec3(floor(id.x / 6.0), id.y, face + 3.0)); // offices light up in runs
      float lit = step(mix(h, run, 0.65), mix(0.03, 0.2, uNight)) * step(3.0, hgt) * step(hgt, vHeight - 2.5);

      // interiors: warm tungsten, some cool office, occasional TV-blue; blinds and depth falloff
      vec3 warm = vec3(1.0, 0.56, 0.24);
      vec3 cool = vec3(0.55, 0.72, 1.0);
      vec3 tv = vec3(0.3, 0.45, 1.0);
      float pick = fract(h * 13.0);
      vec3 room = pick < 0.72 ? warm : pick < 0.93 ? cool : tv;
      float blinds = mix(1.0, 0.55 + 0.45 * step(0.5, fract(f.y * 9.0)), step(0.6, fract(h * 5.0)));
      float interior = (0.25 + 0.5 * fract(h * 7.0)) * (0.55 + 0.45 * f.y) * blinds;
      float flicker = pick > 0.93 ? 0.75 + 0.25 * sin(uTime * 7.0 + h * 50.0) : 1.0;
      vec3 windowLight = room * interior * flicker * lit;

      // facade base: concrete (tinted, rough) or dark glass (reflective)
      vec3 concrete = vTint * (0.012 + 0.02 * smoothstep(0.0, 140.0, hgt));
      float moon = max(dot(n, uMoonDir), 0.0);
      concrete += vTint * moon * mix(0.05, 0.02, uNight);
      // daylight: sky ambient + direct sun, and a warm rake of light at golden hour
      vec3 dayConcrete = vTint * (0.05 + 0.03 * smoothstep(0.0, 140.0, hgt) + 0.32 * sunLit);
      concrete = mix(concrete, dayConcrete, uDay) + vTint * vec3(1.0, 0.55, 0.3) * sunLit * uGolden * 0.3;
      vec3 glassBase = mix(vec3(0.006, 0.008, 0.012), vec3(0.022, 0.032, 0.045), uDay);
      float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
      vec3 refl = skyReflect(reflect(-v, n)) * fres * mix(0.25, 1.0, glass);
      vec3 base = mix(concrete, glassBase, glass) + refl;
      float slab = 0.75 + 0.25 * step(0.07, fract(hgt / 3.7));

      // far away the grid aliases into sparkle: fade to its average (≈ lit fraction × frame area)
      float farK = smoothstep(220.0, 520.0, depth);
      float avgLit = mix(0.03, 0.2, uNight) * 0.45;
      vec3 nearCol = mix(base * slab, windowLight + base * 0.4, frame) + frame * (1.0 - lit) * vec3(0.004, 0.005, 0.008);
      vec3 farCol = base + warm * avgLit * 0.4;
      col = mix(nearCol, farCol, farK);
    }

    // dynamic point lights (unrolled: dynamic indexing was ~60% of frame time on iGPUs)
    #pragma unroll_loop_start
    for ( int i = 0; i < ${MAX_LIGHTS}; i ++ ) {
      {
        vec3 d = uLights[ i ].xyz - vWorld;
        float d2 = dot(d, d);
        float r2 = uLights[ i ].w * uLights[ i ].w;
        if (d2 < r2) {
          float att = 1.0 - d2 / r2;
          att *= att;
          float lam = max(dot(n, d) * inversesqrt(d2 + 1e-4), 0.0) * 0.8 + 0.2;
          col += uLightColors[ i ] * att * lam;
        }
      }
    }
    #pragma unroll_loop_end

    float fog = 1.0 - exp(-pow(depth * uFogDensity, 2.0));
    float haze = (1.0 - smoothstep(0.0, 60.0, vWorld.y)) * smoothstep(40.0, 400.0, depth) * 0.55 * (1.0 - 0.7 * uDay); // low street haze
    gl_FragColor = vec4(mix(col, uFogColor, clamp(max(fog, haze), 0.0, 1.0)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createTowerMaterial(shared) {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uNight: shared.uNight,
      uDay: shared.uDay,
      uGolden: shared.uGolden,
      uSunDir: shared.uSunDir,
      uTime: shared.uTime,
      uFogColor: shared.uFogColor,
      uFogDensity: shared.uFogDensity,
      uMoonDir: shared.uMoonDir,
      uLights: shared.uLights,
      uLightColors: shared.uLightColors,
    },
  });
}
