// Manhattan, loosely (pure data). The story's block grid stays the island's Midtown/Downtown
// core; around it: the Hudson and East River shorelines tapering to the Battery, Central Park to
// the north with the Upper West/East Sides alongside and Billionaires' Row pencil towers on its
// south edge, Harlem beyond, and the landmarks — Empire State, Chrysler, One World Trade Center.
// Scale is roughly 1:4 horizontally and 1:1.7 vertically against the real city.
import { rng } from './math.js';

export const ISLAND = {
  west: -482, // Hudson shoreline (x) before the wobble (streets/traffic stop at ±440)
  east: 482, // East River shoreline
  tipStart: -1000, // the island starts to narrow here (z)…
  tip: -1160, // …to the Battery
  north: 1150, // Harlem River
  jersey: -745, // New Jersey waterfront (x) across the Hudson
  brooklyn: 805, // Brooklyn waterfront across the East River
};

/** Is (x, z) on the far shores (New Jersey / Brooklyn)? */
export const onFarShore = (x, z) => x < ISLAND.jersey + 14 * Math.sin(z * 0.006) || x > ISLAND.brooklyn + 18 * Math.sin(z * 0.005 + 2);

/** Half-width wobble of each shoreline, so the island edge isn't ruler-straight. */
const westAt = (z) => ISLAND.west + 22 * Math.sin(z * 0.0042) + 9 * Math.sin(z * 0.013 + 2);
const eastAt = (z) => ISLAND.east + 26 * Math.sin(z * 0.0031 + 1) + 8 * Math.sin(z * 0.011);
const taper = (z) => {
  if (z > ISLAND.tipStart) return 1;
  const t = Math.min(1, (ISLAND.tipStart - z) / (ISLAND.tipStart - ISLAND.tip));
  return Math.sqrt(Math.max(0, 1 - t * t));
};

/** Signed distance-ish to the shore: > 0 on land, < 0 in the rivers (metres). */
export function landMargin(x, z) {
  const k = taper(z);
  const mid = (westAt(z) + eastAt(z)) / 2;
  const half = ((eastAt(z) - westAt(z)) / 2) * k;
  const across = half - Math.abs(x - mid);
  const along = Math.min(z - ISLAND.tip, ISLAND.north - z);
  return Math.min(across, along);
}

export const onLand = (x, z, pad = 0) => landMargin(x, z) > pad;

/** Central Park (rectangle, with the reservoir inside it). */
export const PARK = { x: [-150, 150], z: [262, 700], reservoir: { x: 10, z: 520, rx: 85, rz: 55 } };
export const inPark = (x, z, pad = 0) => x > PARK.x[0] - pad && x < PARK.x[1] + pad && z > PARK.z[0] - pad && z < PARK.z[1] + pad;

const MASONRY = 0.05; // tower seeds whose facade hash picks masonry (see shaders/tower.js)
const GLASS = 0.1; // …and glass curtain wall

/**
 * Landmarks as stacks of boxes (a setback silhouette is a union of boxes from the ground up),
 * plus the extras only the renderer needs (masts, crowns, spires) in `detail`.
 */
export const LANDMARKS = [
  {
    name: 'Empire State Building',
    x: 140,
    z: -60,
    tint: [0.78, 0.72, 0.6], // Indiana limestone
    seed: MASONRY,
    tiers: [
      [30, 22, 24],
      [24, 18, 86],
      [18, 13.5, 196],
      [13.5, 10.5, 212],
      [9.5, 7.5, 226],
      [6.5, 5.5, 234],
    ],
    detail: { kind: 'esbMast', base: 234 },
  },
  {
    name: 'Chrysler Building',
    x: 236,
    z: -18,
    tint: [0.7, 0.7, 0.72],
    seed: MASONRY,
    tiers: [
      [16, 16, 40],
      [12, 12, 150],
      [9, 9, 158],
    ],
    detail: { kind: 'chryslerCrown', base: 158, halfWidth: 9 },
  },
  {
    name: 'One World Trade Center',
    x: -70,
    z: -905,
    tint: [0.55, 0.62, 0.72],
    seed: GLASS,
    tiers: [
      [17, 17, 34],
      [12, 12, 150, true], // physics-only cores: the tapered glass shaft is drawn in `detail`
      [8, 8, 250, true],
    ],
    detail: { kind: 'wtc', base: 34, top: 250, bottomHalf: 17, topHalf: 9 },
  },
];

/** Tower boxes for every landmark (tagged so they can be told apart from the fill). */
export function landmarkTowers() {
  const out = [];
  for (const lm of LANDMARKS) {
    for (const [w, d, h, hidden] of lm.tiers) {
      out.push({ x: lm.x, z: lm.z, w, d, h, tint: lm.tint, seed: lm.seed, kind: 'landmark', landmark: lm.name, hidden: Boolean(hidden) });
    }
  }
  return out;
}

const footprintHit = (t, lm, pad = 6) => {
  const [w, d] = lm.tiers[0];
  return Math.abs(t.x - lm.x) < t.w + w + pad && Math.abs(t.z - lm.z) < t.d + d + pad;
};

/** Should a core fill tower stay? (on the island, off the landmarks' plots, out of the park) */
export function keepCoreTower(t) {
  if (t.kind) return true; // story towers are never touched
  if (!onLand(t.x, t.z, Math.max(t.w, t.d) + 6)) return false;
  if (LANDMARKS.some((lm) => footprintHit(t, lm))) return false;
  if (inPark(t.x, t.z, Math.max(t.w, t.d) + 8)) return false;
  return true;
}

/** Stack a tall fill tower into a wedding-cake setback silhouette (NYC 1916 zoning look). */
function setback(t, r) {
  if (t.h < 70 || r() > 0.55) return [t];
  const tiers = 2 + Math.floor(r() * 2);
  const out = [];
  for (let i = 0; i < tiers; i++) {
    const k = i / tiers;
    out.push({ ...t, w: t.w * (1 - k * 0.32), d: t.d * (1 - k * 0.32), h: t.h * (0.45 + ((i + 1) / tiers) * 0.55) });
  }
  return out;
}

/**
 * The districts outside the story core. `density` thins them like the core fill.
 * @returns {object[]} towers
 */
export function districtTowers(density = 1, seed = 4711) {
  const r = rng(seed);
  const towers = [];
  const block = 46;
  const lot = (bx, bz, hMin, hMax, slim = 0) => {
    const w = slim ? 4 + r() * 2 : 6 + r() * 9;
    const d = slim ? 4 + r() * 2 : 6 + r() * 9;
    return { x: bx + (r() - 0.5) * (block - 2 * w - 8), z: bz + (r() - 0.5) * (block - 2 * d - 8), w, d, h: hMin + r() * (hMax - hMin) };
  };
  // Upper West / Upper East Side along the park, Harlem to the north
  for (let bz = 262; bz <= 1100; bz += block) {
    for (let bx = -420; bx <= 420; bx += block) {
      const keep = r();
      const harlem = bz > 740;
      const facingPark = !harlem && Math.abs(Math.abs(bx) - 190) < 40; // the tall row on Central Park West / Fifth Ave
      const t = harlem ? lot(bx, bz, 16, 48) : facingPark ? lot(bx, bz, 60, 130) : lot(bx, bz, 24, 80);
      if (keep > density) continue;
      if (!onLand(t.x, t.z, Math.max(t.w, t.d) + 6) || inPark(t.x, t.z, Math.max(t.w, t.d) + 8)) continue;
      towers.push(...setback(t, r));
    }
  }
  // Billionaires' Row: pencil-thin supertall towers on the park's south edge
  for (const x of [-118, -64, 22, 88]) {
    towers.push({ x, z: 248, w: 5 + r() * 1.5, d: 5 + r() * 1.5, h: 190 + r() * 60, tint: [0.62, 0.66, 0.74], seed: GLASS, kind: 'pencil' });
  }
  return towers;
}

/** Low skylines across the rivers (New Jersey, Brooklyn): lights on the water at night. */
export function farShoreTowers(density = 1, seed = 99) {
  const r = rng(seed);
  const out = [];
  for (let z = -1400; z <= 1200; z += 38) {
    for (const side of [-1, 1]) {
      if (r() > density * 0.9) continue;
      const shore = side < 0 ? ISLAND.jersey - 30 : ISLAND.brooklyn + 30;
      out.push({ x: shore + side * r() * 420, z: z + r() * 20, w: 8 + r() * 14, d: 8 + r() * 14, h: 12 + r() * (side > 0 && z < -700 ? 110 : 45), kind: 'far' });
    }
  }
  return out;
}
