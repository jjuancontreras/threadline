// Film grade (runs after ACES tone mapping): crushed blacks, teal-steel shadows,
// sodium-warm highlights, gentle S-curve, reduced saturation and fine animated grain.
import { Uniform } from 'three';
import { Effect } from 'postprocessing';

const fragment = /* glsl */ `
  uniform float uGrain;
  uniform float uSaturation;
  uniform float uContrast;
  uniform float uGain;

  float grainHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = max(inputColor.rgb, 0.0) * uGain;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // split tone
    vec3 shadowTint = vec3(0.86, 0.97, 1.08);
    vec3 highTint = vec3(1.07, 0.99, 0.9);
    c *= mix(shadowTint, highTint, smoothstep(0.08, 0.6, l));
    // lift/crush: blacks sit slightly cool, never milky
    c = max(c - 0.006, 0.0) * 1.006;
    // S-curve around mid-grey
    c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
    // saturation (keeps neon accents but mutes the city)
    l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uSaturation);
    // grain, weighted to the mids
    float g = grainHash(uv * resolution + fract(time * 7.13) * 91.7) - 0.5;
    c += g * uGrain * (0.35 + 0.65 * (1.0 - abs(l * 2.0 - 1.0)));
    outputColor = vec4(c, inputColor.a);
  }
`;

export class GradeEffect extends Effect {
  constructor({ grain = 0.035, saturation = 0.86, contrast = 0.22, gain = 0.94 } = {}) {
    super('GradeEffect', fragment, {
      uniforms: new Map([
        ['uGrain', new Uniform(grain)],
        ['uSaturation', new Uniform(saturation)],
        ['uContrast', new Uniform(contrast)],
        ['uGain', new Uniform(gain)],
      ]),
    });
  }
}
