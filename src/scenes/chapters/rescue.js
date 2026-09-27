// Chapter 5 — RESCUE (interactive) and the outro pull-back.
import { createRescue, stepRescue, fireAnchor, anchoredCount, strain } from '../../physics/rescue.js';
import { WORLD, RESCUE_ANCHORS } from '../../core/layout.js';
import { clamp, lerp, smoothstep, vLerp } from '../../core/math.js';
import { noseAt } from './impact.js';
import { EPILOGUE } from '../beats.js';

const RESCUE_SHOT = { pos: [34, 132, -396], look: [-88, 62, -505], hfov: 84, fov: 50, lag: 0.6 };
const CLOSE_SHOT = { pos: [6, 55.4, -491.5], look: [-16, 52.6, -500], hfov: 70, fov: 46, lag: 0.9 };
const WIDE_SHOT = { pos: [70, 175, -300], look: [-20, 60, -560], hfov: 80, fov: 50 };

// Epilogue: THREADRUNNER fires a line at a tower and zips off, gone before the wide shot settles.
const LEAVE = { fire: EPILOGUE.heroFire, launch: EPILOGUE.heroLaunch, gone: EPILOGUE.heroGone };

function departure(ctx, stand, p) {
  const anchor = ctx.midAnchor;
  if (p >= LEAVE.gone) {
    ctx.showHero(false);
    return;
  }
  const u = smoothstep(LEAVE.launch, LEAVE.gone, p);
  const arc = Math.sin(u * Math.PI) * 14;
  const pos = [lerp(stand[0], anchor[0], u), lerp(stand[1] + 1.4, anchor[1] - 2, u) + arc, lerp(stand[2], anchor[2], u)];
  const toward = [anchor[0] - stand[0], 0, anchor[2] - stand[2]];
  const aim = smoothstep(LEAVE.fire - 0.04, LEAVE.fire, p);
  const weights = u > 0 ? { fly: 1 - u * 0.5, swing: u * 0.5 } : { stand: 1 - aim, shoot: aim };
  ctx.setHero(pos, weights, u > 0 ? { forward: toward } : { forward: vLerp([1, 0, 0.6], toward, aim), ground: stand[1] });
  ctx.hero.pulse(0.5 + Math.sin(ctx.time * 1.5) * 0.3);
  if (p > LEAVE.fire) ctx.tether(0, ctx.hero.hand(), anchor, { extend: clamp((p - LEAVE.fire) / 0.03), strain: 0, intensity: 1.2 * (1 - u) });
}

export function createRescueController(ctx) {
  let r = null;
  let savedAt = -1;
  const fireTimes = Array(RESCUE_ANCHORS.length).fill(-1);
  let seen = 0;

  function onFired(f) {
    fireTimes[f.index] = ctx.time;
    ctx.audio.thwip(0.2);
    ctx.audio.zap();
    ctx.shake.add(0.35);
    ctx.comic.word('TZING', { x: 30 + f.index * 12, y: 30 + (f.index % 2) * 14, color: '#ff4d3a', size: 0.55, tilt: -6 });
    if (anchoredCount(r) === RESCUE_ANCHORS.length) ctx.comic.flash(0.9);
  }

  return {
    get state() {
      return r;
    },
    get saved() {
      return Boolean(r?.saved);
    },
    fire(i) {
      if (!r || r.saved) return;
      r = fireAnchor(r, i, false);
    },
    /** Live, real-time rescue while the chapter is on screen. */
    update(dt) {
      ctx.night = 1;
      if (!r) r = createRescue(noseAt(6.5), WORLD.gap.xMin, WORLD.train.stopMargin);
      if (!r.saved) r = stepRescue(r, Math.min(dt, 0.1));
      while (seen < r.fired.length) onFired(r.fired[seen++]);
      if (r.saved && savedAt < 0) {
        savedAt = ctx.time;
        ctx.onSaved();
      }
      const k = strain(r);
      const n = anchoredCount(r);
      ctx.track.setCollapse(1);
      ctx.train.setNose(r.x, ctx.time, r.saved ? 0 : 1 - k * 0.3);
      ctx.setGantry(null, true, { idle: 1 }, r.saved ? 1 - smoothstep(0.8, 2.6, ctx.time - savedAt) : 1);
      ctx.setContainer(null);

      const roof = ctx.train.leadRoof(r.x);
      const heroPos = [roof[0], roof[1] + 1.4, roof[2]];
      const relaxed = r.saved ? smoothstep(0, 1.5, ctx.time - savedAt) : 0;
      ctx.setHero(heroPos, { brace: 1 - relaxed, stand: relaxed }, { forward: r.saved ? [1, 0, 0.3] : [-1, 0, 0.15], ground: roof[1] });
      ctx.hero.pulse(0.6 + k * 1.2 + Math.sin(ctx.time * 9) * 0.2 * k);
      const hand = ctx.hero.hand();
      RESCUE_ANCHORS.forEach((a, i) => {
        if (!r.anchored[i]) return;
        ctx.tether(2 + i, hand, a, {
          extend: clamp((ctx.time - fireTimes[i]) / 0.18),
          strain: r.saved ? 0 : k,
          intensity: 1.3 - relaxed * 0.4,
        });
      });
      ctx.bursts.embers.set(hand, n > 0 && !r.saved ? (ctx.time * 1.4) % 1.2 : 0);
      ctx.flashLight(hand, n > 0 && !r.saved ? 0.35 + k * 0.4 : 0.15);
      if (!r.saved) ctx.shake.hold(0.12 + k * 0.28);

      const gap = WORLD.gap.xMin - r.x;
      ctx.heartBpm = r.saved ? 0 : lerp(150, 72, clamp(gap / 130));
      ctx.readout(r.v * 3.6, heroPos[1]);
      ctx.rescueHud = { gap, anchored: n, saved: r.saved };
      ctx.shot(r.saved && ctx.time - savedAt > 1.2 ? CLOSE_SHOT : RESCUE_SHOT);
      return { anchorsVisible: !r.saved, anchored: r.anchored };
    },
    /** Scroll-driven epilogue after the save. */
    outro(p) {
      ctx.night = 1;
      const x = r ? r.x : WORLD.gap.xMin - WORLD.train.stopMargin;
      ctx.track.setCollapse(1);
      ctx.train.setNose(x, ctx.time, 0);
      ctx.setGantry(null, true, { idle: 1 }, 0);
      ctx.setContainer(null);
      const roof = ctx.train.leadRoof(x);
      departure(ctx, [roof[0] + 5, roof[1], roof[2]], p);
      ctx.readout(0, roof[1]);
      const u = smoothstep(0, 0.8, p);
      ctx.shot({ pos: vLerp(CLOSE_SHOT.pos, WIDE_SHOT.pos, u), look: vLerp(CLOSE_SHOT.look, WIDE_SHOT.look, u), hfov: lerp(60, 80, u), fov: 46, lag: 0.5 });
    },
  };
}
