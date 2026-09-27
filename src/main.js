// THREADLINE bootstrap: builds the world, wires scroll/UI/audio, runs the frame loop.
import './styles/main.css';
import { loadFonts } from './core/fonts.js';
import * as THREE from 'three';
import { animate } from 'animejs';
import { detectQuality, createMonitor } from './core/quality.js';
import { createRenderer } from './core/renderer.js';
import { createScroll } from './core/scroll.js';
import { createShared } from './core/shared.js';
import { generateTowers, RESCUE_ANCHORS } from './core/layout.js';
import { createCity } from './scenes/city.js';
import { createEnvironment } from './scenes/environment.js';
import { createTrack } from './scenes/track.js';
import { createTrain } from './scenes/train.js';
import { createTraffic } from './scenes/traffic.js';
import { createCrowd } from './scenes/crowd.js';
import { createMothership } from './scenes/mothership.js';
import { GANTRY_SPOT } from './scenes/chapters/threat.js';
import { createDirector } from './scenes/director.js';
import { createFreeSwing } from './scenes/freeswing.js';
import { createThreadrunner } from './characters/threadrunner.js';
import { createGantry, createContainer } from './characters/gantry.js';
import { createTethers } from './fx/tethers.js';
import { createBurst, createDebris } from './fx/particles.js';
import { createShake } from './fx/shake.js';
import { createHud } from './ui/hud.js';
import { createComic } from './ui/comic.js';
import { createNav } from './ui/nav.js';
import { createRescueUI } from './ui/rescueUI.js';
import { createTouchPad } from './ui/touchPad.js';
import { createModes } from './core/modes.js';
import { revealTitle, titleProgress } from './ui/title.js';
import { createAudio } from './audio/engine.js';

loadFonts();
const html = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
html.classList.toggle('reduced', reduced);
const overlay = document.querySelector('.overlay');
const sections = [...document.querySelectorAll('.chapter')];
const hooks = { ready: false, webgl: false, chapter: 0, p: 0, rescue: 'pending', free: null };
window.__threadline = hooks;

function textOnly(reason) {
  html.classList.add('no-webgl');
  sections.forEach((s) => s.classList.add('active'));
  hooks.ready = true;
  hooks.reason = reason;
}

function buildWorld(stage, quality) {
  const { scene } = stage;
  const shared = createShared();
  const towers = generateTowers(quality.density);
  const env = createEnvironment(shared, quality);
  const track = createTrack();
  const train = createTrain(shared);
  const hero = createThreadrunner();
  hero.root.scale.setScalar(1.5);
  const gantry = createGantry();
  const container = createContainer();
  const tethers = createTethers(8);
  const pixel = { value: 600 };
  const pc = quality.particles;
  const bursts = {
    dust: createBurst('dust', Math.round(420 * pc), { ring: true, speed: 34, seed: 3, pixel }),
    sparks: createBurst('sparks', Math.round(520 * pc), { speed: 26, dir: [0, 0.6, 0.2], spread: 2.2, seed: 5, pixel }),
    embers: createBurst('embers', Math.round(160 * pc), { speed: 7, dir: [0, 0.5, 0], spread: 2, seed: 9, pixel }),
    puff: createBurst('dust', Math.round(90 * pc), { ring: true, speed: 9, seed: 13, pixel }),
    debris: createDebris(Math.round(70 * Math.max(pc, 0.5))),
  };
  const city = createCity(towers, shared, quality);
  const traffic = createTraffic({ high: 2200, medium: 1100, low: 380 }[quality.tier], shared);
  const crowd = createCrowd({ high: 2400, medium: 1200, low: 360 }[quality.tier], shared);
  const mothership = createMothership(shared, towers, GANTRY_SPOT);
  scene.add(env.group, city.group, track.group, train.group, hero.root, gantry.root, container, tethers.group);
  scene.add(bursts.dust.points, bursts.sparks.points, bursts.embers.points, bursts.puff.points, bursts.debris.mesh);
  scene.add(traffic.group, crowd.group, mothership.group, ...gantry.lights);
  scene.add(...hero.capeMeshes);
  return { shared, towers, env, city, traffic, crowd, mothership, track, train, hero, gantry, container, tethers, bursts, pixel };
}

/** Compile every material up front so later chapters don't hitch on first reveal. */
function precompile(stage) {
  const hidden = [];
  stage.scene.traverse((o) => {
    if (!o.visible) {
      hidden.push(o);
      o.visible = true;
    }
  });
  stage.renderer.compile(stage.scene, stage.camera);
  stage.render(0);
  hidden.forEach((o) => (o.visible = false));
}

function init() {
  const quality = detectQuality();
  hooks.quality = quality.tier;
  const scroll = createScroll(reduced);
  const canvas = document.getElementById('stage');
  const stage = createRenderer(canvas, quality);
  const audio = createAudio();
  const soundBtn = document.querySelector('[data-sound]');
  soundBtn.addEventListener('click', toggleSound);
  async function toggleSound() {
    const on = await audio.toggle();
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.querySelector('b').textContent = on ? 'ON' : 'OFF';
  }

  if (!stage) {
    textOnly('webgl-unavailable');
    createNav(overlay, { onChapter: (i) => sections[i].scrollIntoView(), onFreeSwing: () => {}, onSound: toggleSound });
    return;
  }
  hooks.webgl = true;
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // allow the browser to restore the context
    contextLost = true;
    textOnly('context-lost');
  });
  // GPU resources are gone after a loss; a reload is the reliable way to rebuild the whole world.
  canvas.addEventListener('webglcontextrestored', () => location.reload());

  const world = buildWorld(stage, quality);
  precompile(stage);
  const hud = createHud(overlay, reduced);
  const comic = createComic(overlay, reduced);
  const shake = createShake(!reduced);
  const crossfadeEl = overlay.querySelector('[data-crossfade]');

  const rescueUI = createRescueUI(overlay, RESCUE_ANCHORS, (i) => director.rescue.fire(i));
  const director = createDirector({
    ...world,
    camera: stage.camera,
    lens: stage.lens,
    reduced,
    hud,
    comic,
    audio,
    shake,
    rescueUI,
    title: (v) => titleProgress(overlay, v),
    crossfade: () => animate(crossfadeEl, { opacity: [0.85, 0], duration: 700, ease: 'outQuad' }),
    onSaved: () => modes.onSaved(),
  });

  const free = createFreeSwing({
    towers: world.towers,
    camera: stage.camera,
    canvas,
    reduced,
    onMiss: () => comic.word('NO ANCHOR', { x: 50, y: 30, color: '#9aa6b8', size: 0.35, tilt: 0 }),
  });
  hooks.free = free.stats;
  createTouchPad(overlay, free.press);

  const modes = createModes({ scroll, hud, free, html, hooks, isSaved: () => director.rescue.saved });
  const { enterFree, exitFree } = modes;
  const nav = createNav(overlay, { onChapter: modes.gotoChapter, onFreeSwing: modes.toggleFree, onSound: toggleSound });
  modes.bindNav(nav);
  document.querySelector('[data-cta-free]').addEventListener('click', enterFree);
  // escape hatch for the scroll lock: fire every remaining tether at once
  overlay.querySelector('[data-rescue-skip]').addEventListener('click', () => RESCUE_ANCHORS.forEach((_, i) => director.rescue.fire(i)));
  window.addEventListener('keydown', (e) => e.key === 'Escape' && exitFree());

  const monitor = createMonitor(quality, stage.dpr, ({ dpr, post, shed }) => {
    stage.setDpr(dpr);
    stage.setPost(post);
    if (shed) {
      world.env.shed();
      world.traffic.setDensity(0.35);
      world.crowd.setDensity(0.35);
    }
    hooks.downgraded = { dpr, post, shed };
  });

  if (new URLSearchParams(location.search).has('debug')) hooks.debug = { scene: stage.scene, stage, world, free };
  Object.assign(hooks, {
    goto: (i, p = 0) => scroll.goto(i, p, true),
    enterFree,
    exitFree,
    fireAnchor: (i) => director.rescue.fire(i),
    swingPath: () => director.path.samples.length,
    trickMoments: () => director.trickMoments(),
    freeGrounded: () => free.grounded,
  });

  revealTitle(overlay, reduced);
  const timer = new THREE.Timer();
  timer.connect(document); // pauses cleanly when the tab is hidden
  let time = 0;
  let activeSection = -1;
  const halfTan = () => Math.tan(THREE.MathUtils.degToRad(stage.camera.fov) / 2);

  const MAX_FRAME_ERRORS = 3; // consecutive failures before falling back to the text story
  let frameErrors = 0;
  function frame(ms) {
    if (contextLost) return;
    try {
      step(ms);
      frameErrors = 0;
    } catch (err) {
      frameErrors++;
      if (frameErrors === 1) console.error('[threadline] frame failed', err);
      if (frameErrors >= MAX_FRAME_ERRORS) {
        textOnly('frame-failed');
        return;
      }
    }
    requestAnimationFrame(frame);
  }

  function step(ms) {
    const tA = performance.now();
    timer.update(ms);
    const dt = Math.min(timer.getDelta(), 0.1);
    time += dt;
    scroll.raf(ms);
    world.shared.uTime.value = time;
    world.pixel.value = (window.innerHeight * stage.dpr) / (2 * halfTan());
    const located = scroll.locate();
    const { index, p } = modes.resolve(located.index, located.p);
    const freeOn = modes.freeOn;
    if (index !== activeSection) {
      sections.forEach((s, i) => s.classList.toggle('active', i === index));
      activeSection = index;
      nav.setActive(index);
    }
    if (freeOn) director.updateFree(dt, time, free);
    else {
      if (index !== 4) hud.saved(false);
      else if (director.rescue.saved) hud.saved(true);
      director.update(dt, time, index, p);
    }
    world.env.update(time, stage.camera.position, director.ctx.night);
    world.city.update(stage.camera.position);
    world.traffic.update(dt * (reduced ? 0.6 : 1));
    world.crowd.update(dt * (reduced ? 0.6 : 1), world.traffic.clock);
    const tB = performance.now();
    if (hooks.debug?.cam) {
      // ?debug only: orbit a fixed camera around the hero for turnaround captures
      const { dist, yaw, height } = hooks.debug.cam;
      const h = world.hero.root.position;
      stage.camera.position.set(h.x + Math.sin(yaw) * dist, h.y + height, h.z + Math.cos(yaw) * dist);
      stage.camera.lookAt(h.x, h.y + 0.3, h.z);
    } else if (hooks.debug?.fixed) {
      // ?debug only: park the camera anywhere (street-life review shots)
      stage.camera.position.fromArray(hooks.debug.fixed.pos);
      stage.camera.lookAt(...hooks.debug.fixed.look);
    }
    stage.render(dt);
    const tC = performance.now();
    hooks.timing = { logic: tB - tA, render: tC - tB };
    monitor.tick(dt);
    hooks.chapter = index;
    hooks.p = p;
    hooks.freeActive = freeOn;
    hooks.attached = free.attached;
    hooks.fps = monitor.fps;
    hooks.heroPos = world.hero.root.position.toArray();
    hooks.camPos = stage.camera.position.toArray();
    const r = director.rescue.state;
    if (r) hooks.rescueState = { x: r.x, v: r.v, anchored: r.anchored.filter(Boolean).length, fired: r.fired.length, saved: r.saved };
    hooks.ready = true;
  }
  requestAnimationFrame(frame);
}

try {
  init();
} catch (err) {
  console.error('[threadline] init failed', err);
  textOnly('init-failed');
}
