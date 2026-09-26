// Chapter 2 — SWING: scrub the pre-simulated Verlet swing down the canyon, with a forward
// dive through each arc and an acrobatic trick in every free-flight gap between tethers.
import { samplePath } from '../../physics/swingPath.js';
import { vNorm, vAdd, vScale, vSub, smoothstep, clamp, lerp } from '../../core/math.js';
import { TRICKS, trickAt, trickWindow } from '../../characters/tricks.js';

const STILLS = 4; // reduced-motion: still framings with crossfades
const SHOOT_TIME = 0.22; // seconds the firing arm stays snapped out after an attach

/** Body frame: tilt the rope-aligned body forward along travel so the hero dives into arcs. */
function heroFrame(s) {
  const vdir = vNorm(s.vel);
  const flat = vNorm([vdir[0], 0, vdir[2]]);
  if (s.anchor) {
    const rope = vNorm(vSub(s.anchor, s.pos));
    return { up: vNorm(vAdd(vScale(rope, 0.62), vScale(vdir, 0.55))), forward: vNorm(vAdd(vdir, [0, -0.35, 0])), flat, vdir };
  }
  const falling = smoothstep(0, -18, s.vel[1]); // head-first when dropping
  const up = vNorm(vAdd(vScale(vdir, 0.45 + falling * 0.5), [0, 0.7 - falling * 0.55, 0]));
  return { up, forward: vNorm(vAdd(flat, [0, -0.6 - falling * 0.6, 0])), flat, vdir, falling };
}

function flightTrick(ctx, s, f) {
  const meta = ctx.path.flight[s.index];
  if (!meta || meta.seg === 0 || meta.end - meta.start < 0.45) return null; // seg 0 = the dive off the spire
  const t = ctx.path.samples[s.index].t;
  const k = trickWindow((t - meta.start) / (meta.end - meta.start));
  if (k <= 0 || k >= 1) return null;
  return trickAt(TRICKS[meta.seg % TRICKS.length], k, f.vdir);
}

export function swing(ctx, p, dt) {
  ctx.night = 1;
  const reduced = ctx.reduced;
  const u = reduced ? (Math.min(Math.floor(p * STILLS), STILLS - 1) + 0.5) / STILLS : p;
  if (reduced) ctx.crossfadeKey(`swing-${Math.min(Math.floor(p * STILLS), STILLS - 1)}`);
  const s = samplePath(ctx.path.samples, u);
  const f = heroFrame(s);
  const sinceAttach = ctx.path.sinceAttach[s.index];

  const trick = reduced ? null : flightTrick(ctx, s, f);
  let weights;
  if (s.anchor) {
    const shoot = 1 - smoothstep(0, SHOOT_TIME, sinceAttach);
    weights = { swing: 1 - shoot * 0.7, shoot: shoot * 0.7 };
  } else weights = trick ? trick.weights : { dive: 0.4 + (f.falling || 0) * 0.6, fly: 0.6 - (f.falling || 0) * 0.6 };
  ctx.setHero(s.pos, weights, { up: f.up, forward: f.forward, trick });
  if (!trick) ctx.hero.flutter(smoothstep(20, 50, s.speed));
  ctx.hero.pulse(0.4 + smoothstep(25, 50, s.speed));

  if (s.anchor) ctx.tether(0, ctx.hero.hand(), s.anchor, { extend: clamp(sinceAttach / 0.14), intensity: 1.2 });

  const speedK = reduced ? 0 : smoothstep(22, 52, s.speed);
  ctx.fx.lines = speedK;
  ctx.fx.blur = speedK * 0.5;
  ctx.wind = smoothstep(5, 55, s.speed);
  ctx.readout(s.speed * 3.6, s.pos[1]);

  if (reduced) {
    const side = vNorm([f.flat[2], 0, -f.flat[0]]);
    ctx.shot({ pos: vAdd(vAdd(s.pos, vScale(side, 16)), [0, 4, 6]), look: s.pos, fov: 50, cut: true });
    return;
  }
  const lateral = Math.sin(p * 17) * 1.8;
  const side = [f.flat[2], 0, -f.flat[0]];
  const back = lerp(6.5, 9, speedK) + (trick ? 1.5 : 0); // pull out a little to frame tricks
  const pos = vAdd(vAdd(vSub(s.pos, vScale(f.flat, back)), [0, 2.4 - f.vdir[1] * 2.5, 0]), vScale(side, lateral));
  const look = vAdd(s.pos, vScale(f.vdir, 8));
  ctx.shot({ pos, look, fov: 58 + speedK * 20, roll: lateral * -0.02, lag: p < 0.05 ? 0.3 : 0.16, collide: true });
}
