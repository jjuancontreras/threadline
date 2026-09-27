// Where the interactive street and rooftop props go (pure data, no rendering):
// street lamps on the kerbs (lined up with the sodium pools painted on the asphalt),
// barrel clusters on roofs, and construction cranes that each dangle a big pipe over a street.
import { STREETS, WORLD } from '../core/layout.js';
import { rng } from '../core/math.js';

export const LAMP = { spacing: 23, height: 7.4, kerb: STREETS.halfWidth + 0.55 };
const AVENUE_HALF = 20;
/** Lamps and cranes are placed where the free-swing player spends time (around the spawn). */
export const PROP_ZONE = { x: [-230, 230], z: [-760, 140] };
export const CRANE = { mast: 40, jib: 46, trolley: 30, cable: 15, pipeLength: 26, pipeRadius: 1.9, sway: 0.06 };

const inZone = (x, z) => x > PROP_ZONE.x[0] && x < PROP_ZONE.x[1] && z > PROP_ZONE.z[0] && z < PROP_ZONE.z[1];

const insideTower = (towers, p) => towers.some((t) => Math.abs(p[0] - t.x) < t.w + 1.5 && Math.abs(p[2] - t.z) < t.d + 1.5 && p[1] < t.h + 1.5);

/** Is (x, z) inside the road surface (so a lamp there would stand in traffic)? */
function onRoad(x, z) {
  const d = (c, o) => Math.abs((((c - o) / STREETS.period + 0.5) % 1 + 1) % 1 - 0.5) * STREETS.period;
  return d(x, STREETS.offsetX) < STREETS.halfWidth || d(z, STREETS.offsetZ) < STREETS.halfWidth || Math.abs(x) < AVENUE_HALF;
}

/**
 * Street lamps: one every 23 m along each kerb, alternating sides, with the arm reaching over
 * the road. { x, z, base, top, arm:[dx, dz] }
 */
export function streetLamps(towers = []) {
  const lamps = [];
  const along = (from, to) => {
    const out = [];
    for (let s = Math.ceil((from - 11.5) / LAMP.spacing) * LAMP.spacing + 11.5; s < to; s += LAMP.spacing) out.push(s);
    return out;
  };
  const place = (x, z, arm) => {
    if (!inZone(x, z) || onRoad(x, z) || insideTower(towers, [x, 1, z])) return;
    lamps.push({ x, z, base: 0, top: LAMP.height, arm, kind: 'lamp' });
  };
  // north-south streets (+ both avenue kerbs)
  const nsStreets = [...STREETS.alongX.map((c) => ({ c, half: LAMP.kerb })), { c: 0, half: AVENUE_HALF + 0.55 }];
  for (const { c, half } of nsStreets) {
    along(PROP_ZONE.z[0], PROP_ZONE.z[1]).forEach((z, i) => {
      const side = i % 2 ? 1 : -1;
      place(c + side * half, z, [-side, 0]);
    });
  }
  // east-west streets
  for (const c of STREETS.crossZ) {
    along(PROP_ZONE.x[0], PROP_ZONE.x[1]).forEach((x, i) => {
      const side = i % 2 ? 1 : -1;
      place(x, c + side * LAMP.kerb, [0, -side]);
    });
  }
  return lamps;
}

/** Barrel clusters on flat roofs: { x, z, roof, n, collider } */
export function barrelClusters(towers, seed = 17) {
  const r = rng(seed);
  const out = [];
  for (const t of towers) {
    if (t.kind === 'spire' || t.w < 6 || t.d < 6 || r() > 0.28) continue;
    if (!inZone(t.x, t.z)) continue;
    const x = t.x + (r() - 0.5) * (t.w - 3);
    const z = t.z + (r() - 0.5) * (t.d - 3);
    const n = 3 + Math.floor(r() * 4);
    out.push({ x, z, roof: t.h, n, seed: r(), collider: { x, z, w: 1.5, d: 1.5, h: t.h + 1.25, kind: 'barrels' } });
  }
  return out;
}


/** Pipe mouths for a crane at its current sway angle. */
export function pipeEnds(site, sway = 0) {
  const tx = site.x + Math.cos(site.yaw) * CRANE.trolley;
  const tz = site.z + Math.sin(site.yaw) * CRANE.trolley;
  const y = site.roof + CRANE.mast - CRANE.cable - CRANE.pipeRadius;
  const a = site.yaw + Math.PI / 2 + sway;
  const hx = (Math.cos(a) * CRANE.pipeLength) / 2;
  const hz = (Math.sin(a) * CRANE.pipeLength) / 2;
  return { center: [tx, y, tz], a: [tx - hx, y, tz - hz], b: [tx + hx, y, tz + hz], axis: [Math.cos(a), 0, Math.sin(a)] };
}

/**
 * Crane sites: mid-height roofs off the story's avenue canyon, near the free-swing spawn, with
 * the jib turned so the hanging pipe is clear of every building.
 */
export function craneSites(towers, near = [0, -330], count = 3) {
  const avoid = [WORLD.watch, WORLD.gantryRoof].map((w) => [w.x, w.z]);
  const cands = towers
    .filter((t) => t.h >= 45 && t.h <= 95 && t.w >= 8 && t.d >= 8 && Math.abs(t.x) > 60 && t.kind !== 'spire')
    .filter((t) => avoid.every(([x, z]) => Math.hypot(t.x - x, t.z - z) > 60))
    .map((t) => ({ t, d: Math.hypot(t.x - near[0], t.z - near[1]) }))
    .filter(({ d }) => d > 50 && d < 280)
    .sort((a, b) => a.d - b.d);
  const sites = [];
  for (const { t } of cands) {
    if (sites.some((s) => Math.hypot(s.x - t.x, s.z - t.z) < 130)) continue;
    let yaw = null;
    for (let k = 0; k < 24 && yaw === null; k++) {
      const trial = { x: t.x, z: t.z, roof: t.h, yaw: (k / 24) * Math.PI * 2 };
      const { a, b, center } = pipeEnds(trial);
      const clear = [a, b, center, ...[0.25, 0.75].map((u) => a.map((v, i) => v + (b[i] - v) * u))].every((p) => !insideTower(towers, p));
      if (clear && [a, b].every((p) => p[1] > 12)) yaw = trial.yaw;
    }
    if (yaw === null) continue;
    sites.push({ x: t.x, z: t.z, roof: t.h, yaw, phase: sites.length * 1.7 });
    if (sites.length === count) break;
  }
  return sites;
}
