// Chapter 1 — PERCH: dusk turns to night; crane up the spire to THREADRUNNER.
import { smoothstep, vNorm } from '../../core/math.js';
import { PATH_START } from '../../physics/swingPath.js';
import { keyedShot } from '../camera.js';
import { WORLD } from '../../core/layout.js';

// the hero perches on the spire roof's south-east corner, facing out along its diagonal
const ROOF = WORLD.spire.h;
const CORNER = [WORLD.spire.x + WORLD.spire.w, ROOF, WORLD.spire.z - WORLD.spire.d];
export const PERCH_FORWARD = vNorm([1, 0, -1]);

const KEYS = [
  { p: 0.0, pos: [14, 34, 160], look: [-10, 80, -60], fov: 50 },
  { p: 0.35, pos: [4, 98, 96], look: [-27, 140, 21], fov: 48 },
  { p: 0.62, pos: [-8, 149, 36], look: [-27.5, 151, 21.5], fov: 44 },
  // three-quarter front: both roof edges recede from the corner under the hero
  { p: 0.82, pos: [-21.6, 152.2, 17.6], look: [-27.4, 150.8, 21.6], fov: 40 },
  // over the shoulder, off the corner and down the canyon
  { p: 1.0, pos: [-31.6, 154.6, 25.8], look: [-8, 128, -60], fov: 52 },
];

export function perch(ctx, p) {
  ctx.night = smoothstep(0.04, 0.8, p);
  ctx.titleVisible = 1 - smoothstep(0.1, 0.28, p);
  const rise = smoothstep(0.86, 1, p);
  // pelvis sits just inside the corner; feet are planted on the roof, toes at the edge
  const spot = [CORNER[0] - 0.55, PATH_START[1], CORNER[2] + 0.55];
  ctx.setHero(spot, { perch: 1 - rise * 0.5, crouch: rise * 0.3, dive: rise * 0.2 }, { forward: PERCH_FORWARD, ground: ROOF + 0.02 });
  ctx.hero.pulse(0.3 + 0.3 * Math.sin(ctx.time * 2.4) + rise);
  ctx.readout(0, PATH_START[1]);
  const shot = keyedShot(KEYS, p);
  ctx.shot({ ...shot, lag: 0.35 });
}
