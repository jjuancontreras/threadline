// Chapter 3 — THREAT: a two-tether slingshot onto the rooftop, then a twinkle in the sky
// becomes a city-sized carrier that drops GANTRY (and a squad of coloured units) on the city.
import { smoothstep, invLerp, vLerp, vAdd, vSub, vScale, vNorm, vLen, lerp, clamp, easeOutCubic } from '../../core/math.js';
import { WORLD } from '../../core/layout.js';
import { closestOnTower } from '../../physics/anchors.js';
import { trickAt } from '../../characters/tricks.js';
import { SHIP } from '../mothership.js';
import { THREAT, SQUAD_DROPS } from '../beats.js';

const W = WORLD.watch;
export const WATCH_SPOT = [W.x - W.w + 1.6, W.h + 1.45, W.z - W.d + 1.6];
const LAND_SPOT = [W.x + 1, W.h + 1.45, W.z + 3];
export const GANTRY_SPOT = [WORLD.gantryRoof.x - 4, WORLD.gantryRoof.h, WORLD.gantryRoof.z + 6];
export const CONTAINER_REST = [WORLD.gantryRoof.x + 4, WORLD.gantryRoof.h + 1.3, WORLD.gantryRoof.z - 5];
export const TRAIN_CH3 = [-430, -270];

// beats (chapter progress)
const B = THREAT;

/** Two rooftop-edge anchors beyond the landing roof, one either side of the flight line. */
export function slingAnchors(towers, from, to) {
  const dir = vNorm([to[0] - from[0], 0, to[2] - from[2]]);
  const right = [-dir[2], 0, dir[0]];
  const best = { l: null, r: null };
  for (const t of towers) {
    if (t.h < to[1] + 12) continue;
    const rel = [t.x - to[0], 0, t.z - to[2]];
    const ahead = rel[0] * dir[0] + rel[2] * dir[2];
    const lat = rel[0] * right[0] + rel[2] * right[2];
    if (ahead < 10 || ahead > 130 || Math.abs(lat) < 12 || Math.abs(lat) > 110) continue;
    const side = lat > 0 ? 'r' : 'l';
    const score = Math.abs(Math.abs(lat) - 40) + Math.abs(ahead - 45) * 0.5;
    if (!best[side] || score < best[side].score) best[side] = { t, score };
  }
  const point = (b, fallback) => {
    if (!b) return fallback;
    const c = closestOnTower(b.t, vAdd(to, [0, 26, 0]));
    return [c[0], Math.min(c[1], b.t.h - 0.5), c[2]];
  };
  return [point(best.l, vAdd(to, vAdd(vScale(right, -40), vAdd(vScale(dir, 40), [0, 30, 0])))), point(best.r, vAdd(to, vAdd(vScale(right, 40), vAdd(vScale(dir, 40), [0, 30, 0]))))];
}

/** Hero path for the slingshot: stretch → launch arc (with a backflip) → land → run to the edge. */
function slingshot(ctx, p, end, endVel) {
  const [a1, a2] = ctx.sling;
  const vdir = vNorm(endVel);
  if (p < B.load) {
    const k = p / B.load;
    const pos = vAdd(end, vScale(vdir, 12 * (k - (k * k) / 2) * 2)); // decelerating stretch
    return { pos, weights: { pull: 1 }, forward: vNorm([vdir[0], 0, vdir[2]]), tethers: clamp(k * 3), speed: vLen(endVel) * (1 - k), up: [0, 1, 0] };
  }
  const loadPos = vAdd(end, vScale(vdir, 12));
  if (p < B.land) {
    const k = easeOutCubic(invLerp(B.load, B.land, p));
    const mid = vAdd(vLerp(loadPos, LAND_SPOT, 0.5), [0, 24, 0]);
    const pos = vLerp(vLerp(loadPos, mid, k), vLerp(mid, LAND_SPOT, k), k);
    const fdir = vNorm(vSub(LAND_SPOT, loadPos));
    const flip = invLerp(0.2, 0.8, k);
    const trick = flip > 0 && flip < 1 && !ctx.reduced ? trickAt('backflip', flip, fdir) : null;
    return {
      pos,
      weights: trick ? trick.weights : k > 0.85 ? { land: 1 } : { fly: 1 },
      trick,
      forward: [fdir[0], 0, fdir[2]],
      tethers: 1 - smoothstep(0.08, 0.3, k),
      speed: 38 * (1 - k * 0.8),
      up: [0, 1, 0],
    };
  }
  if (p < B.run) {
    const k = invLerp(B.land, B.run, p);
    const r = smoothstep(0.25, 1, k);
    const pos = vLerp(LAND_SPOT, WATCH_SPOT, r);
    const dist = vLen(vSub(WATCH_SPOT, LAND_SPOT)) * r;
    const running = k > 0.2 && k < 0.95;
    return {
      pos,
      weights: k < 0.25 ? { land: 1 } : running ? { run: 1 } : { crouch: 0.6, stand: 0.4 },
      gait: running ? { phase: dist * 1.9, amount: 1 } : undefined,
      forward: vNorm(vSub(WATCH_SPOT, LAND_SPOT)),
      tethers: 0,
      speed: running ? 9 : 0,
      ground: W.h,
      up: [0, 1, 0],
    };
  }
  return { pos: WATCH_SPOT, weights: { crouch: 0.6, stand: 0.4 }, forward: [-0.55, 0, -0.84], tethers: 0, speed: 0, ground: W.h, up: [0, 1, 0] };
}

function shipState(p, time) {
  const doors = [smoothstep(B.docked - 0.02, B.drop, p), ...SQUAD_DROPS.map((d) => smoothstep(d - 0.04, d, p))];
  // unclamped past 1 so the carrier can play landing dust after touchdown
  const drops = [0, ...SQUAD_DROPS.map((d) => Math.max(0, (p - d) / 0.07))];
  const tw = invLerp(B.twinkle - 0.01, B.twinkle + 0.012, p) * (1 - invLerp(B.twinkle + 0.02, B.arrive + 0.02, p));
  return { arrive: invLerp(B.arrive, B.docked, p), twinkle: tw, doors, drops, time };
}

export function threat(ctx, p) {
  ctx.night = 1;
  const samples = ctx.path.samples;
  const last = samples[samples.length - 1];
  const h = slingshot(ctx, p, last.pos, last.vel);
  ctx.setHero(h.pos, h.weights, { forward: h.forward, up: h.up, trick: h.trick, gait: h.gait, ground: h.ground });
  ctx.hero.pulse(0.4 + Math.sin(ctx.time * 3) * 0.2 + (h.tethers > 0 ? 0.6 : 0));
  if (h.tethers > 0) {
    ctx.tether(0, ctx.hero.hand('R'), ctx.sling[1], { extend: h.tethers, strain: p < B.load ? 0.5 : 0, intensity: 1.3 });
    ctx.tether(1, ctx.hero.hand('L'), ctx.sling[0], { extend: h.tethers, strain: p < B.load ? 0.5 : 0, intensity: 1.3 });
  }
  ctx.readout(h.speed * 3.6, h.pos[1]);
  ctx.bursts.puff.set([LAND_SPOT[0], W.h + 0.2, LAND_SPOT[2]], (p - B.land + 0.005) * 12);
  ctx.cue('land', p > B.land, () => ctx.shake.add(0.25));

  const ship = shipState(p, ctx.time);
  ctx.mothership.update(ship);
  ctx.alert(p > B.twinkle);
  ctx.train.setNose(lerp(TRAIN_CH3[0], TRAIN_CH3[1], p), ctx.time, 0);

  // GANTRY drops out of the main bay onto its roof
  const drop = invLerp(B.drop, B.impact, p);
  const top = ctx.mothership.bayY();
  const y = lerp(top, GANTRY_SPOT[1], drop * drop);
  ctx.setGantry([GANTRY_SPOT[0], y, GANTRY_SPOT[2]], p > B.drop - 0.005, {
    land: p > B.impact ? 1 - smoothstep(B.impact + 0.04, B.impact + 0.16, p) : 0.3,
    idle: p > B.impact ? smoothstep(B.impact + 0.04, B.impact + 0.16, p) : 0.7,
  });
  ctx.setContainer(CONTAINER_REST, [0, 0.35, 0], true);

  const since = (p - B.impact) * 9;
  ctx.bursts.dust.set([GANTRY_SPOT[0], GANTRY_SPOT[1] + 0.5, GANTRY_SPOT[2]], since);
  ctx.fx.flash = since > 0 ? Math.max(0, 0.18 - since * 1.2) * (ctx.reduced ? 0.4 : 1) : 0;
  ctx.cue('thoom', p > B.impact, () => {
    ctx.comic.word('THOOM', { x: 58, y: 40, color: '#ffcf33', tilt: -10 });
    ctx.comic.flash(1.2);
    ctx.shake.add(0.95);
    ctx.audio.boom(1.2);
    ctx.scatter(GANTRY_SPOT, 90); // the street below GANTRY's roof empties
  });
  ctx.cue('arrive', p > B.arrive, () => ctx.audio.boom(0.5));
  ctx.shot(threatShot(p, h, y, ship));
}

function threatShot(p, h, gantryY, ship) {
  if (p < B.load) {
    // behind the hero, looking past him toward the roof so both tethers read as a V
    const back = vNorm(vSub(h.pos, LAND_SPOT));
    return { pos: vAdd(vAdd(h.pos, vScale(back, 11)), [0, 4.5, 0]), look: vLerp(h.pos, vAdd(LAND_SPOT, [0, 14, 0]), 0.35), hfov: 88, fov: 56, lag: 0.25 };
  }
  if (p < B.land) return { pos: vAdd(h.pos, [10, 3.5, 13]), look: vAdd(h.pos, [2, -2, -10]), hfov: 80, fov: 55, lag: 0.16 };
  if (p < B.run) return { pos: vAdd(WATCH_SPOT, [9, 3.2, 11]), look: vAdd(h.pos, [0, 0.5, 0]), hfov: 70, fov: 50, lag: 0.3 };
  if (p < B.arrive) return { pos: vAdd(WATCH_SPOT, [3, 2.2, 7]), look: SHIP.far, hfov: 66, fov: 46, lag: 0.45 };
  if (p < B.drop) {
    const k = invLerp(B.arrive, B.drop, p);
    return { pos: vAdd(WATCH_SPOT, [4, 2.4, 9]), look: vLerp(SHIP.far, [20, SHIP.y - 60, -620], smoothstep(0, 0.8, k)), hfov: 96, fov: 58, lag: 0.5 };
  }
  if (p < B.impact + 0.06) return { pos: vAdd(WATCH_SPOT, [1.5, 3.4, 5]), look: [GANTRY_SPOT[0], Math.max(gantryY, GANTRY_SPOT[1]) + 3, GANTRY_SPOT[2]], hfov: 56, fov: 40, lag: 0.22 };
  return { pos: [-96, 150, -330], look: [-40, 125, -610], hfov: 100, fov: 56, lag: 0.6, ship };
}
