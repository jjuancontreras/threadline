// Pedestrian simulation (pure JS): people walk the sidewalks either side of every street,
// wait at the kerb until the parallel traffic has green (the grid-wide signal in streetSim.js),
// stand around in small groups, and scatter away from story impacts.
import { STREETS } from '../core/layout.js';
import { rng } from '../core/math.js';
import { signalGreen } from './streetSim.js';

export const PED = {
  kerbOffset: 1.7, // sidewalk centre-line, metres outside the road edge
  bandHalf: 0.9, // people spread across the sidewalk width
  speed: [1.05, 1.65],
  idleShare: 0.14, // fraction standing still (window-shopping, chatting)
  fleeSpeed: [4.2, 5.6],
  // most people live in the blocks the story camera sees; the rest are spread city-wide
  focus: { x: [-130, 130], z: [-620, 70] },
  focusShare: 0.72,
  homeRange: [45, 110], // metres a walker strays from home before turning back
};
const AVENUE_HALF = 20;

function crossingsFor(axis) {
  if (axis === 'z') return STREETS.crossZ.map((c) => ({ c, half: STREETS.halfWidth }));
  return [{ c: 0, half: AVENUE_HALF }, ...STREETS.alongX.map((c) => ({ c, half: STREETS.halfWidth }))];
}

/** Sidewalk lines: both kerbs of the avenue, of every north-south street and of every cross street. */
export function buildSidewalks() {
  const { crossZ, alongX, halfWidth, extentX, extentZ } = STREETS;
  const off = halfWidth + PED.kerbOffset;
  const walks = [];
  for (const s of [-1, 1]) walks.push({ axis: 'z', c: s * (AVENUE_HALF + PED.kerbOffset), min: extentZ[0], max: extentZ[1] });
  for (const x of alongX) for (const s of [-1, 1]) walks.push({ axis: 'z', c: x + s * off, min: extentZ[0], max: extentZ[1] });
  for (const z of crossZ) for (const s of [-1, 1]) walks.push({ axis: 'x', c: z + s * off, min: extentX[0], max: extentX[1] });
  return walks.map((w) => ({
    ...w,
    span: w.max - w.min,
    // kerb-to-kerb intervals of each road this sidewalk crosses (world coordinate along the axis)
    roads: crossingsFor(w.axis)
      .map(({ c, half }) => [c - half - 0.3, c + half + 0.3])
      .filter(([a, b]) => a > w.min && b < w.max)
      .sort((a, b) => a[0] - b[0]),
  }));
}

/** Index of the road interval containing s, or -1. */
function roadAt(walk, s) {
  for (let i = 0; i < walk.roads.length; i++) if (s > walk.roads[i][0] && s < walk.roads[i][1]) return i;
  return -1;
}

/**
 * @param {number} count
 * @param {number} [seed]
 */
export function createPedSim(count, seed = 77) {
  const r = rng(seed);
  const walks = buildSidewalks();
  const total = walks.reduce((a, w) => a + w.span, 0);
  const people = [];
  const span = (lo, hi) => lo + r() * (hi - lo);
  // the part of each sidewalk inside the focus box, as [lo, hi] along its axis (or null)
  const focusPart = (w) => {
    const { x, z } = PED.focus;
    const [across, along] = w.axis === 'x' ? [z, x] : [x, z];
    if (w.c < across[0] || w.c > across[1]) return null;
    return [Math.max(w.min, along[0]), Math.min(w.max, along[1])];
  };
  const focused = walks.map((w) => ({ w, part: focusPart(w) })).filter((f) => f.part);
  const focusTotal = focused.reduce((a, f) => a + f.part[1] - f.part[0], 0);
  const pickBy = (items, len, sum) => {
    let pick = r() * sum;
    for (const it of items) {
      if (pick < len(it)) return it;
      pick -= len(it);
    }
    return items[items.length - 1];
  };
  for (let i = 0; i < count; i++) {
    // a sidewalk (weighted by length, focus blocks favoured), then a spot that is not in the road
    let walk;
    let s;
    if (focused.length && r() < PED.focusShare) {
      const f = pickBy(focused, (it) => it.part[1] - it.part[0], focusTotal);
      walk = f.w;
      s = span(...f.part);
    } else {
      walk = pickBy(walks, (w) => w.span, total);
      s = walk.min + r() * walk.span;
    }
    const road = roadAt(walk, s);
    if (road >= 0) s = walk.roads[road][0] - 0.5;
    const idle = r() < PED.idleShare;
    people.push({
      walk,
      s,
      home: s,
      range: span(...PED.homeRange),
      lat: (r() * 2 - 1) * PED.bandHalf,
      dir: r() < 0.5 ? -1 : 1,
      speed: span(...PED.speed),
      v: 0,
      idle,
      face: r() * Math.PI * 2, // idle facing
      phase: r() * Math.PI * 2,
      flee: 0, // seconds of panic left
      fleeDir: 1,
      fleeSpeed: span(...PED.fleeSpeed),
    });
  }

  /** Where the person would stop: the kerb before the next road in their direction of travel. */
  function kerbAhead(p) {
    const roads = p.walk.roads;
    if (p.dir > 0) {
      for (const [a] of roads) if (a >= p.s - 0.05) return a;
    } else {
      for (let i = roads.length - 1; i >= 0; i--) if (roads[i][1] <= p.s + 0.05) return roads[i][1];
    }
    return null;
  }

  function stepPerson(p, dt, time) {
    const w = p.walk;
    let target = 0;
    let dir = p.dir;
    if (p.flee > 0) {
      p.flee -= dt;
      dir = p.fleeDir;
      target = p.fleeSpeed;
    } else if (!p.idle) {
      target = p.speed;
      const onRoad = roadAt(w, p.s) >= 0;
      // on the crosswalk already: keep going; otherwise wait at the kerb for the walk phase
      if (!onRoad && !signalGreen(w.axis, time)) {
        const kerb = kerbAhead(p);
        if (kerb !== null && Math.abs(kerb - p.s) < 0.6 + p.v * 0.6) target = 0;
      }
    }
    p.v += (target - p.v) * Math.min(1, dt * (p.flee > 0 ? 6 : 3));
    p.s += dir * p.v * dt;
    // strayed far enough from home (and on the pavement): turn around and head back
    if (p.flee <= 0 && Math.abs(p.s - p.home) > p.range && Math.sign(p.s - p.home) === p.dir && roadAt(w, p.s) < 0) {
      p.dir = -p.dir;
      p.v = 0; // stop, turn, then set off again (so a kerb right behind is respected)
    }
    p.phase += p.v * dt * 3.2; // stride frequency grows with speed
    if (p.s > w.max) p.s -= w.span;
    else if (p.s < w.min) p.s += w.span;
  }

  return {
    people,
    walks,
    step(dt, time) {
      const h = Math.min(dt, 0.1);
      for (const p of people) stepPerson(p, h, time);
    },
    /**
     * Everyone within `radius` (horizontal) of `center` runs away along their sidewalk for `seconds`.
     * @returns {number} how many people panicked
     */
    scatter(center, radius, seconds = 10) {
      let n = 0;
      for (const p of people) {
        const [x, z] = this.position(p);
        const dx = x - center[0];
        const dz = z - center[2];
        if (dx * dx + dz * dz > radius * radius) continue;
        const away = p.walk.axis === 'x' ? dx : dz;
        p.fleeDir = away >= 0 ? 1 : -1;
        p.flee = seconds * (0.8 + r() * 0.4);
        n++;
      }
      return n;
    },
    /** World [x, z] (sidewalk line + lateral spread). */
    position(p) {
      const { walk } = p;
      return walk.axis === 'x' ? [p.s, walk.c + p.lat] : [walk.c + p.lat, p.s];
    },
    /** Heading yaw (0 = facing +x). Idle people keep their own facing. */
    yaw(p) {
      if (p.idle && p.flee <= 0) return p.face;
      const dir = p.flee > 0 ? p.fleeDir : p.dir;
      return p.walk.axis === 'x' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    },
  };
}
