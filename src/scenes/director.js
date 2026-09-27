// The director: owns the one continuous camera and routes each frame to a chapter.
import * as THREE from 'three';
import { perch } from './chapters/perch.js';
import { swing } from './chapters/swing.js';
import { threat, GANTRY_SPOT } from './chapters/threat.js';
import { impact } from './chapters/impact.js';
import { createRescueController } from './chapters/rescue.js';
import { createCameraRig } from './camera.js';
import { createCues } from './cues.js';
import { EPILOGUE } from './beats.js';
import { simulateSwingPath, annotatePath } from '../physics/swingPath.js';
import { closestOnTower } from '../physics/anchors.js';
import { setLight, clearLight, LIGHT } from '../core/shared.js';
import { fogColorFor } from '../shaders/sky.js';
import { skyAt, skyAtTime, storySky } from '../core/daycycle.js';
import { RESCUE_ANCHORS, towersNear } from '../core/layout.js';
import { slingAnchors, WATCH_SPOT } from './chapters/threat.js';

const smoothstepLocal = (a, b, v) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const LABELS = ['01 · PERCH', '02 · SWING', '03 · THREAT', '04 · IMPACT', '05 · RESCUE', 'EPILOGUE'];

function buildPath(towers) {
  const samples = simulateSwingPath(towers);
  return { samples, ...annotatePath(samples) };
}

function midAnchor(towers) {
  // a real facade point between the watch roof and the train's final position
  const target = [-60, 96, -474];
  let best = null;
  let bestD = Infinity;
  for (const t of towers) {
    const c = closestOnTower(t, target);
    const d = Math.hypot(c[0] - target[0], c[1] - target[1], c[2] - target[2]);
    if (d < bestD && t.h > 70) {
      bestD = d;
      best = [c[0], Math.min(c[1], t.h - 0.5), c[2]];
    }
  }
  return best || target;
}

/** Pull a chase camera in front of any tower that blocks its view of the subject. */
function unblock(shot, subject, towers) {
  if (!shot.collide || !subject) return shot;
  // only towers near the subject→camera segment can block it
  const mid = [(subject[0] + shot.pos[0]) / 2, 0, (subject[2] + shot.pos[2]) / 2];
  const near = towersNear(towers, mid, Math.hypot(shot.pos[0] - subject[0], shot.pos[2] - subject[2]) / 2 + 1);
  const inside = (p) => near.some((t) => Math.abs(p[0] - t.x) < t.w + 0.6 && Math.abs(p[2] - t.z) < t.d + 0.6 && p[1] < t.h + 0.6);
  const steps = 14;
  let last = subject;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const p = [subject[0] + (shot.pos[0] - subject[0]) * k, subject[1] + (shot.pos[1] - subject[1]) * k, subject[2] + (shot.pos[2] - subject[2]) * k];
    if (inside(p)) return { ...shot, pos: [last[0], last[1] + 1.5, last[2]] };
    last = p;
  }
  return shot;
}

export function createDirector(w) {
  const rig = createCameraRig(w.camera);
  const cues = createCues();
  let lastKey = '';
  const fogTmp = new THREE.Color();

  const ctx = {
    reduced: w.reduced,
    time: 0,
    night: 0,
    titleVisible: 1,
    wind: 0,
    heartBpm: 0,
    slowmo: 0,
    rescueHud: null,
    alertOn: false,
    fx: { blur: 0, lines: 0, aberration: 0, flash: 0 },
    path: buildPath(w.towers),
    midAnchor: midAnchor(w.towers),
    towers: w.towers,
    mothership: w.mothership,
    hero: w.hero,
    gantry: w.gantry,
    train: w.train,
    track: w.track,
    bursts: w.bursts,
    comic: w.comic,
    audio: w.audio,
    shake: w.shake,
    _shot: null,
    shot(s) {
      ctx._shot = s;
    },
    /**
     * @param opts {{up?:number[], forward?:number[], trick?:{axis:number[], angle:number}|null,
     *   ground?:number, gait?:{phase:number, amount:number}, snap?:boolean}}
     *   ground: plant the feet exactly on this world Y (perches, rooftops, the train roof).
     */
    setHero(pos, weights, { up = [0, 1, 0], forward = [0, 0, -1], trick = null, ground, gait, snap = false } = {}) {
      const root = w.hero.root;
      root.position.set(pos[0], pos[1], pos[2]);
      w.hero.orient(up, forward, { dt: ctx._dt, snap, trick });
      w.hero.pose(weights, ctx._dt, { snap, gait });
      if (ground !== undefined) root.position.y += ground - w.hero.feetY();
      root.updateMatrixWorld(true);
      w.hero.syncCape(ctx.time, Math.min(1, (weights.swing || 0) + (weights.dive || 0) + (weights.fly || 0)));
      setLight(w.shared, LIGHT.hero, root.position.toArray(), 10, [1, 0.1, 0.06], 0.1);
    },
    /** Street crowds within radius run from an impact. */
    scatter(center, radius) {
      w.crowd.scatter(center, radius, 12);
    },
    /** Show/hide the hero and the world-space cape together. */
    showHero(visible) {
      w.hero.root.visible = visible;
      w.hero.capeMeshes.forEach((m) => (m.visible = visible));
    },
    /** @param eye 0..1 sensor power; it fades to dark once the train is saved. */
    setGantry(pos, visible, weights = { idle: 1 }, eye = 1) {
      const g = w.gantry.root;
      g.visible = visible;
      if (!visible) {
        w.gantry.syncLights(false);
        clearLight(w.shared, LIGHT.eye);
        return;
      }
      const p = pos || GANTRY_SPOT;
      g.position.set(p[0], p[1], p[2]);
      g.rotation.y = -0.9; // face the bridge span
      w.gantry.pose(weights, ctx._dt);
      g.updateMatrixWorld(true);
      w.gantry.syncLights(true, eye);
      setLight(w.shared, LIGHT.eye, w.gantry.eyeWorld(), 22, [eye, 0.1 * eye, 0.05 * eye], 0.45);
    },
    setContainer(pos, rot = [0, 0, 0], visible = true) {
      w.container.visible = Boolean(pos) && visible;
      if (!pos) return;
      w.container.position.set(pos[0], pos[1], pos[2]);
      w.container.rotation.set(rot[0], rot[1], rot[2]);
    },
    tether(i, a, b, o = {}) {
      w.tethers.draw(i, a, b, ctx._dt, w.camera, { time: ctx.time, ...o });
    },
    flashLight(pos, k) {
      if (k <= 0) clearLight(w.shared, LIGHT.flash);
      else setLight(w.shared, LIGHT.flash, pos, 45, [1, 0.55, 0.25], k * 0.55);
    },
    readout(kmh, alt) {
      w.hud.readout(kmh, alt);
    },
    alert(on) {
      ctx.alertOn = on;
    },
    cue(key, active, fn) {
      cues.cue(key, active, ctx._scrubbingBack, fn);
    },
    crossfadeKey(key) {
      if (key !== lastKey) {
        lastKey = key;
        w.crossfade();
      }
    },
    onSaved() {
      w.onSaved();
    },
  };

  const last = ctx.path.samples[ctx.path.samples.length - 1];
  ctx.sling = slingAnchors(w.towers, last.pos, WATCH_SPOT);
  // drops > 1 = landed long ago (landing dust finished)
  const SHIP_DOCKED = { arrive: 1, twinkle: 0, doors: Array(7).fill(1), drops: Array(7).fill(9) };
  const rescue = createRescueController(ctx);
  let prevChapter = 0;
  let prevP = 0;

  function resetFrame() {
    ctx.fx = { blur: 0, lines: 0, aberration: 0, flash: 0 };
    ctx.wind = 0;
    ctx.heartBpm = 0;
    ctx.slowmo = 0;
    ctx.rescueHud = null;
    ctx.alertOn = false;
    ctx.titleVisible = 0;
    ctx.showHero(true);
  }

  let freeClock = 0;
  let wasFree = false;
  let dayOverride = null; // debug/review: pin the free-mode time of day

  function applyGlobals() {
    const sky = ctx.freeSky || storySky(ctx.night);
    ctx.sky = sky;
    w.shared.uNight.value = sky.lights;
    w.shared.uDay.value = sky.day;
    w.shared.uGolden.value = sky.golden;
    w.shared.uSunDir.value.fromArray(sky.sunDir);
    w.shared.uMoonDir.value.fromArray(sky.moonDir);
    w.shared.uFogDensity.value = 0.0019 - 0.0007 * sky.day; // clearer air by day
    fogColorFor(sky.lights, fogTmp, sky.day, sky.golden);
    w.shared.uFogColor.value.copy(fogTmp);
    w.lens.set('uBlur', ctx.fx.blur);
    w.lens.set('uLines', ctx.fx.lines);
    w.lens.set('uAberration', ctx.fx.aberration);
    w.lens.set('uFlash', ctx.fx.flash);
    w.hud.alert(ctx.alertOn);
    w.hud.slowmo(ctx.slowmo);
    w.hud.rescue(ctx.rescueHud);
    w.audio.update(ctx.wind, ctx.heartBpm);
  }

  return {
    ctx,
    rescue,
    get path() {
      return ctx.path;
    },
    /** Pin the free-mode sky to a phase (0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight), or null. */
    setDayPhase(phase) {
      dayOverride = phase;
    },
    /** Skip the free-mode clock forward (seconds). */
    advanceDay(seconds) {
      freeClock += seconds;
    },
    get sky() {
      return ctx.sky;
    },
    /** Story frame. index 0-4 chapters, 5 = outro. */
    update(dt, time, index, p) {
      ctx.freeSky = null;
      wasFree = false;
      ctx._dt = dt;
      ctx.time = time;
      ctx._scrubbingBack = index < prevChapter || (index === prevChapter && p < prevP - 1e-4);
      resetFrame();
      w.tethers.begin();
      w.hud.chapter(LABELS[index]);
      let anchors = { anchorsVisible: false, anchored: [] };
      if (index > 0) ctx.hero.pulse(0.5);
      if (index === 0) perch(ctx, p);
      else if (index === 1) swing(ctx, p, dt);
      else if (index === 2) threat(ctx, p);
      else if (index === 3) impact(ctx, p);
      else if (index === 4) anchors = rescue.update(dt);
      else rescue.outro(p);
      if (index < 2) {
        ctx.train.setNose(-900, time, 0);
        ctx.track.setCollapse(0);
        ctx.setGantry(null, false);
        ctx.setContainer(null);
      }
      if (index === 1) ctx.track.setCollapse(0);
      if (index === 2) ctx.track.setCollapse(0);
      if (index !== 3) {
        ctx.bursts.sparks.set([0, 0, 0], 0);
        ctx.bursts.debris.set([0, 0, 0], 0);
        if (index !== 4) ctx.flashLight([0, 0, 0], 0);
      }
      if (index !== 2) ctx.bursts.dust.set([0, 0, 0], 0);
      if (index !== 4) ctx.bursts.embers.set([0, 0, 0], 0);
      if (index !== 2) {
        ctx.bursts.puff.set([0, 0, 0], 0);
        if (index < 2) ctx.mothership.update({ arrive: 0, twinkle: 0, doors: [], drops: [], time });
        else if (index < 5) ctx.mothership.update({ ...SHIP_DOCKED, time });
        else {
          // epilogue: bay doors seal, then the carrier lifts back into the clouds
          const doors = Array(7).fill(1 - smoothstepLocal(...EPILOGUE.doorsClose, p));
          ctx.mothership.update({ ...SHIP_DOCKED, doors, arrive: 1 - smoothstepLocal(...EPILOGUE.shipDepart, p), time });
        }
      }
      w.title(ctx.titleVisible);
      w.tethers.end();
      w.rescueUI.update(w.camera, index === 4 && anchors.anchorsVisible, anchors.anchored);
      applyGlobals();
      rig.update(unblock(ctx._shot, w.hero.root.position.toArray(), w.towers), dt, w.shake.update(dt));
      prevChapter = index;
      prevP = p;
    },
    /** Free-swing frame: the free controller drives hero + shot; director keeps the world alive. */
    updateFree(dt, time, free) {
      ctx._dt = dt;
      ctx.time = time;
      resetFrame();
      ctx.night = 1;
      if (!wasFree) freeClock = 0; // every visit starts just before dawn
      wasFree = true;
      freeClock += dt;
      ctx.freeSky = dayOverride !== null ? skyAt(dayOverride) : skyAtTime(freeClock);
      w.tethers.begin();
      w.hud.chapter('FREE SWING');
      const x = rescue.state ? rescue.state.x : -12.25;
      ctx.train.setNose(x, time, 0);
      ctx.track.setCollapse(1);
      ctx.setGantry(null, true, { idle: 1 }, 0);
      ctx.setContainer(null);
      ctx.mothership.update({ arrive: 0, twinkle: 0, doors: [], drops: [], time });
      free.update(dt, ctx);
      w.title(0);
      w.tethers.end();
      w.rescueUI.update(w.camera, false, []);
      applyGlobals();
      rig.update(unblock(ctx._shot, w.hero.root.position.toArray(), w.towers), dt, w.shake.update(dt));
    },
    anchors: RESCUE_ANCHORS,
    /** Scroll progress values (chapter 2) at the middle of each scheduled trick. */
    trickMoments() {
      const { samples, flight } = ctx.path;
      const out = [];
      flight.forEach((f, i) => {
        if (!f || f.seg === 0 || f.end - f.start < 0.45) return;
        const mid = f.start + (f.end - f.start) * (0.12 + 0.3);
        if (Math.abs(samples[i].t - mid) < 0.009) out.push(i / (samples.length - 1));
      });
      return out;
    },
  };
}
