// WebGL renderer + pmndrs/postprocessing chain (bloom → lens/tone/vignette).
import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import { LensEffect } from '../shaders/lens.js';
import { GradeEffect } from '../shaders/grade.js';

/** Returns null if WebGL is unavailable so the caller can fall back to the text layer. */
export function createRenderer(canvas, quality) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !quality.post && quality.tier !== 'low', // MSAA is too costly on the GPUs the low tier targets
      powerPreference: 'high-performance',
      stencil: false,
      depth: !quality.post,
    });
  } catch (err) {
    console.warn('[threadline] WebGL unavailable, using text layer.', err?.message);
    return null;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, quality.dprCap);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 1800); // fog is ~opaque by 1.2 km
  const lens = new LensEffect();
  let composer = null;
  let usePost = quality.post;

  const buildComposer = () => {
    composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new BloomEffect({
      intensity: 1.15,
      luminanceThreshold: 0.7,
      luminanceSmoothing: 0.3,
      mipmapBlur: true,
      radius: 0.72,
      levels: quality.tier === 'high' ? 6 : 5,
    });
    // one merged fullscreen pass (the lens blur samples the pre-bloom buffer — cheaper, visually fine)
    composer.addPass(
      new EffectPass(
        camera,
        bloom,
        lens,
        new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
        new GradeEffect({ grain: quality.tier === 'high' ? 0.035 : 0.025 }),
        new VignetteEffect({ darkness: 0.7, offset: 0.24 }),
      ),
    );
  };

  const applyToneMapping = () => {
    renderer.toneMapping = usePost ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = usePost ? 1.0 : 0.85; // no grade pass on the low tier: darken instead
  };
  applyToneMapping();
  if (usePost) buildComposer();

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  return {
    renderer,
    scene,
    camera,
    lens,
    get dpr() {
      return renderer.getPixelRatio();
    },
    get post() {
      return usePost;
    },
    setDpr(v) {
      renderer.setPixelRatio(v);
      resize();
    },
    setPost(on) {
      if (on === usePost) return;
      usePost = on;
      if (!on) {
        composer?.dispose();
        composer = null;
      } else buildComposer();
      applyToneMapping();
      scene.traverse((o) => {
        if (o.material) o.material.needsUpdate = true;
      });
      resize();
    },
    render(dt) {
      if (usePost && composer) composer.render(dt);
      else renderer.render(scene, camera);
    },
  };
}
