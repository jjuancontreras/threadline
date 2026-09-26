// Chapter 4 — IMPACT: GANTRY hurls the container in bullet time and severs the track.
import { smoothstep, clamp, vAdd, vScale, vSub, vLerp, easeInOutCubic } from '../../core/math.js';
import { WORLD } from '../../core/layout.js';
import { IMPACT } from '../beats.js';
import { GANTRY_SPOT, CONTAINER_REST, WATCH_SPOT } from './threat.js';

export const IMPACT_POINT = [0, WORLD.track.y + 0.6, WORLD.track.z];
const G = [0, -18, 0];
const { release: RELEASE, flight: FLIGHT, total: TOTAL } = IMPACT;
const HIT = RELEASE + FLIGHT;
export const TRAIN_CH4 = { start: -270, speed: 20 };
export const noseAt = (tau) => TRAIN_CH4.start + TRAIN_CH4.speed * tau;
const THROW_FROM = vAdd(GANTRY_SPOT, [-1.5, 12.5, 2.5]);
const V0 = vScale(vSub(vSub(IMPACT_POINT, THROW_FROM), vScale(G, 0.5 * FLIGHT * FLIGHT)), 1 / FLIGHT);

/** Story time in seconds from scroll progress, with the bullet-time ramp. */
export function storyTime(p, reduced) {
  if (reduced) return p * TOTAL;
  if (p < 0.3) return (p / 0.3) * RELEASE;
  if (p < 0.72) return RELEASE + ((p - 0.3) / 0.42) * FLIGHT;
  return HIT + ((p - 0.72) / 0.28) * (TOTAL - HIT);
}

function containerAt(tau, grip) {
  if (tau < 0.6) return { pos: CONTAINER_REST, rot: [0, 0.35, 0] };
  if (tau < RELEASE - 0.4) return { pos: vLerp(CONTAINER_REST, grip, smoothstep(0.6, 0.95, tau)), rot: [0, 0.35 * (1 - smoothstep(0.6, 1, tau)), 0] };
  if (tau < RELEASE) return { pos: vLerp(grip, THROW_FROM, smoothstep(RELEASE - 0.4, RELEASE, tau)), rot: [0, 0, 0] };
  const s = tau - RELEASE;
  if (s < FLIGHT) {
    return { pos: vAdd(vAdd(THROW_FROM, vScale(V0, s)), vScale(G, 0.5 * s * s)), rot: [s * 1.1, s * 0.5, s * 1.9] };
  }
  const s2 = s - FLIGHT;
  const vAfter = vScale(vAdd(V0, vScale(G, FLIGHT)), 0.22);
  const p = vAdd(vAdd(IMPACT_POINT, vScale(vAdd(vAfter, [0, -4, 0]), s2)), vScale(G, 0.5 * s2 * s2));
  return { pos: [p[0], Math.max(p[1], 1.4), p[2]], rot: [FLIGHT * 1.1 + s2 * 2, FLIGHT * 0.5, FLIGHT * 1.9 + s2 * 0.8] };
}

function gantryWeights(tau) {
  const bend = smoothstep(0.2, 0.6, tau) * (1 - smoothstep(0.8, 1.1, tau));
  const lift = smoothstep(0.8, 1.2, tau) * (1 - smoothstep(1.55, 1.8, tau));
  const thr = smoothstep(1.55, 1.85, tau) * (1 - smoothstep(2.6, 3.4, tau));
  return { idle: Math.max(0.05, 1 - bend - lift - thr), land: bend, lift, throw: thr };
}

export function impact(ctx, p) {
  ctx.night = 1;
  const tau = storyTime(p, ctx.reduced);
  const slow = ctx.reduced ? 0 : smoothstep(0.26, 0.34, p) * (1 - smoothstep(0.68, 0.76, p));
  ctx.slowmo = slow;
  ctx.fx.aberration = slow;
  ctx.fx.blur = slow * 0.18;

  ctx.setGantry(GANTRY_SPOT, true, gantryWeights(tau));
  const c = containerAt(tau, ctx.gantry.grip());
  ctx.setContainer(c.pos, c.rot, true);
  ctx.train.setNose(noseAt(tau), ctx.time, smoothstep(HIT, HIT + 1, tau));
  ctx.alert(p < 0.12);

  const since = tau - HIT;
  ctx.bursts.sparks.set(IMPACT_POINT, since);
  ctx.bursts.debris.set(IMPACT_POINT, since);
  ctx.track.setCollapse(clamp((tau - HIT - 0.05) / 2.4));
  ctx.fx.flash = since > 0 ? Math.max(0, 0.45 - since * 2) * (ctx.reduced ? 0.4 : 1) : 0;
  ctx.flashLight(IMPACT_POINT, since > 0 ? Math.max(0, 1 - since * 0.8) : 0);
  ctx.cue('kraak', since > 0, () => {
    ctx.comic.word('KRAAK', { x: 45, y: 38, color: '#ff5a36', tilt: 8, size: 1.1 });
    ctx.comic.flash(1.4);
    ctx.shake.add(1);
    ctx.audio.boom(1.5);
  });
  ctx.cue('hurl', tau > RELEASE, () => ctx.audio.boom(0.4));

  // hero: holds, then tethers across to the lead car of the train
  const hu = easeInOutCubic(clamp((tau - 3.4) / 3.1));
  const roof = ctx.train.leadRoof(noseAt(TOTAL));
  const heroPos = vAdd(vLerp(WATCH_SPOT, [roof[0], roof[1] + 1.4, roof[2]], hu), [0, Math.sin(hu * Math.PI) * 22, 0]);
  const flying = hu > 0 && hu < 1;
  ctx.setHero(heroPos, flying ? { swing: hu < 0.6 ? 1 : 0, dive: hu >= 0.6 ? 1 : 0 } : hu >= 1 ? { brace: 1 } : { crouch: 0.5, stand: 0.5 }, {
    up: flying && hu < 0.6 ? vSub(ctx.midAnchor, heroPos) : [0, 1, 0],
    forward: flying ? [-1, 0, 0] : [-0.5, 0, -0.85],
    ground: hu >= 1 ? roof[1] : hu <= 0 ? WORLD.watch.h : undefined,
  });
  if (hu > 0.02 && hu < 0.6) ctx.tether(1, ctx.hero.hand(), ctx.midAnchor, { extend: clamp((hu - 0.02) / 0.08) });
  ctx.readout(flying ? 70 : 0, heroPos[1]);

  // shots
  let shot;
  if (tau < RELEASE) shot = { pos: [40, 55, -522], look: [GANTRY_SPOT[0], GANTRY_SPOT[1] + 6, GANTRY_SPOT[2]], hfov: 64, fov: 46, lag: 0.4 };
  else if (tau < HIT) {
    const a = (tau - RELEASE) * 0.9;
    const off = [-10 * Math.cos(a) + 6 * Math.sin(a), 3.5, 11 * Math.cos(a) + 6 * Math.sin(a)];
    shot = { pos: vAdd(c.pos, off), look: c.pos, hfov: 70, fov: 50, lag: 0.12 };
  } else if (tau < HIT + 1.2) shot = { pos: vAdd(IMPACT_POINT, [20, 9, 30]), look: IMPACT_POINT, hfov: 74, fov: 50, lag: 0.25 };
  else shot = { pos: [24, 60, -490], look: [-150, 52, -500], hfov: 68, fov: 44, lag: 0.5 };
  ctx.shot(shot);
}
