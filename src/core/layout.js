// World layout: pure data shared by rendering, physics and the director.
// Units are meters. Towers are axis-aligned boxes {x, z, w, d, h} where
// (x, z) is the footprint center, w/d are HALF extents and h is roof height.
import { rng } from './math.js';
import { keepCoreTower, landmarkTowers, districtTowers, farShoreTowers } from './manhattan.js';

export const WORLD = {
  avenue: { halfWidth: 24, zStart: 60, zEnd: -470 },
  spire: { x: -36, z: 30, w: 9, d: 9, h: 150, needle: 36 },
  track: { z: -500, y: 52, xMin: -900, xMax: 700, halfWidth: 3.2 },
  bridge: { xMin: -40, xMax: 40 },
  gap: { xMin: -12, xMax: 12 },
  watch: { x: 36, z: -452, w: 11, d: 11, h: 64 }, // hero's ch3 rooftop
  gantryRoof: { x: 60, z: -548, w: 13, d: 13, h: 46 },
  train: { cars: 3, carLength: 20, carGap: 1.2, stopMargin: 0.25 },
};

/** Street grid: block edges of generateTowers() (blocks every 46 m) plus the central avenue. */
const range = (from, to, step) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
export const STREETS = {
  period: 46,
  offsetX: 17,
  offsetZ: 9,
  halfLane: 2.6,
  halfWidth: 5.5,
  avenueLanes: [[-13, -1], [-7.5, -1], [7.5, 1], [13, 1]],
  crossZ: range(-957, 239, 46),
  alongX: range(-397, 431, 46).filter((x) => Math.abs(x) > 30),
  extentX: [-440, 440],
  extentZ: [-1000, 240],
};

/** Rescue anchors: points on facades of towers flanking the track, behind the train. */
export const ANCHOR_TOWERS = [
  { x: -160, z: -472, w: 10, d: 9, h: 90 },
  { x: -168, z: -528, w: 10, d: 9, h: 110 },
  { x: -205, z: -470, w: 10, d: 10, h: 100 },
  { x: -212, z: -530, w: 10, d: 10, h: 120 },
];
/** Roof-edge corners facing the track, all BEHIND the train so tethers brake it. */
export const RESCUE_ANCHORS = [
  [-150.5, 89, -481.5],
  [-158.5, 109, -518.5],
  [-195.5, 99, -480.5],
  [-202.5, 119, -519.5],
];
/** Rescue camera sight-line corridor: random towers here are kept low. */
const LOW_ZONE = { xMin: -230, xMax: 26, zMin: -490, zMax: -380, maxH: 26 };

const CANYON_FLANKS = (() => {
  const out = [];
  const r = rng(77);
  // Tall towers lining the avenue: these carry the chapter-2 swing anchors.
  for (let z = 30; z > -440; z -= 34) {
    for (const side of [-1, 1]) {
      if (side === -1 && z > 0) continue; // spire occupies this slot
      const w = 8 + r() * 4;
      const x = side * (WORLD.avenue.halfWidth + w + 1 + r() * 3);
      out.push({ x, z: z - r() * 6, w, d: 10 + r() * 4, h: 78 + r() * 64 });
    }
  }
  return out;
})();

function overlaps(a, b, pad = 2) {
  return Math.abs(a.x - b.x) < a.w + b.w + pad && Math.abs(a.z - b.z) < a.d + b.d + pad;
}

function blocked(t) {
  const { avenue, track } = WORLD;
  if (Math.abs(t.x) - t.w < avenue.halfWidth + 2 && t.z + t.d > avenue.zEnd - 20 && t.z - t.d < avenue.zStart + 40) return true;
  if (Math.abs(t.z - track.z) - t.d < 12) return true;
  return false;
}

/**
 * Deterministic tower list. `density` (0..1] thins out the random fill;
 * hero towers (spire, flanks, anchors, rooftops) are always present.
 */
export function generateTowers(density = 1, seed = 1337) {
  const r = rng(seed);
  const s = WORLD.spire;
  const fixed = [
    { ...s, kind: 'spire' },
    { ...WORLD.watch, kind: 'watch' },
    { ...WORLD.gantryRoof, kind: 'gantry' },
    { x: 64, z: -472, w: 12, d: 9, h: 90 },
    { x: 110, z: -470, w: 10, d: 9, h: 74 },
    { x: 104, z: -530, w: 12, d: 10, h: 66 },
    ...ANCHOR_TOWERS,
  ];
  const towers = [...fixed];
  for (const f of CANYON_FLANKS) if (!towers.some((o) => overlaps(o, f, 1))) towers.push(f);
  const storyCount = towers.length; // everything before this index is hand-placed for the story
  const block = 46;
  for (let bx = -420; bx <= 420; bx += block) {
    for (let bz = -980; bz <= 220; bz += block) {
      const cx = (bx - 0) / 260;
      const cz = (bz + 300) / 360;
      const downtown = Math.exp(-(cx * cx + cz * cz));
      const lots = 1 + Math.floor(r() * 3);
      for (let i = 0; i < lots; i++) {
        const keep = r();
        const w = 5 + r() * 9;
        const d = 5 + r() * 9;
        const t = {
          x: bx + (r() - 0.5) * (block - 2 * w - 8),
          z: bz + (r() - 0.5) * (block - 2 * d - 8),
          w,
          d,
          h: 14 + downtown * (40 + r() * 110) + r() * 26,
        };
        if (keep > density) continue;
        if (t.x > LOW_ZONE.xMin && t.x < LOW_ZONE.xMax && t.z > LOW_ZONE.zMin && t.z < LOW_ZONE.zMax) t.h = Math.min(t.h, LOW_ZONE.maxH);
        if (blocked(t)) continue;
        if (towers.some((o) => overlaps(o, t))) continue;
        towers.push(t);
      }
    }
  }
  // Manhattan around the story core: trim the fill to the island (off the rivers, the park and
  // the landmark plots), then add the landmarks, the uptown districts and the far shores.
  const story = towers.slice(0, storyCount);
  const extra = [...landmarkTowers(), ...districtTowers(density)];
  const fill = towers.slice(storyCount).filter((t) => keepCoreTower(t) && !extra.some((e) => overlaps(e, t)));
  return [...story, ...fill, ...extra, ...farShoreTowers(density)];
}

/** Towers the hero can collide with / anchor to near a point (cheap XZ filter). */
export function towersNear(towers, p, radius) {
  const out = [];
  for (const t of towers) {
    const dx = Math.max(Math.abs(p[0] - t.x) - t.w, 0);
    const dz = Math.max(Math.abs(p[2] - t.z) - t.d, 0);
    if (dx * dx + dz * dz < radius * radius) out.push(t);
  }
  return out;
}
