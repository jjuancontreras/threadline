// One convolution effect for pmndrs/postprocessing: radial motion blur, speed lines,
// chromatic aberration and impact flash — merged to keep the post chain to one pass.
import { Uniform, Vector2 } from 'three';
import { Effect, EffectAttribute } from 'postprocessing';

const fragment = /* glsl */ `
  uniform float uBlur;
  uniform float uLines;
  uniform float uAberration;
  uniform float uFlash;
  uniform vec2 uCenter;

  float h1(float n) { return fract(sin(n) * 43758.5453); }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 dir = uv - uCenter;
    float dist = length(dir * vec2(aspect, 1.0));
    vec3 col = inputColor.rgb;

    if (uBlur > 0.001) {
      vec3 acc = col;
      for (int i = 1; i < 8; i++) {
        float k = float(i) / 8.0;
        acc += texture2D(inputBuffer, uv - dir * k * uBlur * 0.12).rgb;
      }
      col = mix(col, acc / 8.0, smoothstep(0.08, 0.55, dist));
    }

    if (uAberration > 0.001) {
      vec2 off = dir * uAberration * 0.02;
      col.r = mix(col.r, texture2D(inputBuffer, uv + off).r, 0.85);
      col.b = mix(col.b, texture2D(inputBuffer, uv - off).b, 0.85);
    }

    if (uLines > 0.001) {
      float ang = atan(dir.y, dir.x * aspect);
      float seg = floor((ang + 3.14159) * 38.0);
      float frame = floor(time * 14.0);
      float streak = step(0.93, h1(seg * 1.7 + frame * 13.1));
      float along = fract(dist * 3.0 - time * 5.0 + h1(seg) );
      float mask = smoothstep(0.36, 0.9, dist) * smoothstep(0.0, 0.3, along);
      col += vec3(0.72, 1.0, 0.95) * streak * mask * uLines * 0.32;
    }

    col = mix(col, vec3(1.0), clamp(uFlash, 0.0, 1.0));
    outputColor = vec4(col, inputColor.a);
  }
`;

export class LensEffect extends Effect {
  constructor() {
    super('LensEffect', fragment, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['uBlur', new Uniform(0)],
        ['uLines', new Uniform(0)],
        ['uAberration', new Uniform(0)],
        ['uFlash', new Uniform(0)],
        ['uCenter', new Uniform(new Vector2(0.5, 0.5))],
      ]),
    });
  }
  set(name, value) {
    this.uniforms.get(name).value = value;
  }
}
