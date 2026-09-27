// Street-life simulation shared by traffic and pedestrians (pure JS, no rendering):
// - one signal cycle for the whole grid (north-south vs east-west phases),
// - lanes derived from the street grid, each with its stop lines before every crossing,
// - car following with the Intelligent Driver Model, treating a red stop line as a stopped car.
import { STREETS } from '../core/layout.js';
import { rng } from '../core/math.js';

/** Grid-wide signal cycle, seconds. 'z' = traffic running along z (north-south). */
export const SIGNAL = { cycle: 18, zGreen: [0, 8], xGreen: [9, 17] };

/** Is traffic moving along `axis` allowed to enter crossings at time t? */
export function signalGreen(axis, t) {
  const k = ((t % SIGNAL.cycle) + SIGNAL.cycle) % SIGNAL.cycle;
  const [a, b] = axis === 'z' ? SIGNAL.zGreen : SIGNAL.xGreen;
  return k >= a && k < b;
}

export const CAR = { length: 4.6, minGap: 2, headway: 1.2, accel: 2.4, brake: 4, hardBrake: 7, lookAhead: 70 };
const AVENUE_HALF = 20; // painted avenue half-width (see shaders/ground.js)
const STOP_BACK = 1.6; // stop line sits this far before the zebra
const MAX_STEP = 1 / 30;

/** Crossing centre-lines a lane passes, each with the half-width of the road it crosses. */
function crossingsFor(axis) {
  if (axis === 'z') return STREETS.crossZ.map((c) => ({ c, half: STREETS.halfWidth }));
  return [{ c: 0, half: AVENUE_HALF }, ...STREETS.alongX.map((c) => ({ c, half: STREETS.halfWidth }))];
}

/**
 * Every driving lane. u is the lane coordinate (0..span, increasing in the direction of travel);
 * stops are the u of each stop line and the far edge of the crossing box after it.
 */
export function buildLanes() {
  const { avenueLanes, crossZ, alongX, halfLane, extentX, extentZ } = STREETS;
  const raw = [];
  for (const [x, dir] of avenueLanes) raw.push({ axis: 'z', c: x, dir, min: extentZ[0], max: extentZ[1] });
  for (const z of crossZ) for (const dir of [-1, 1]) raw.push({ axis: 'x', c: z + dir * halfLane, dir, min: extentX[0], max: extentX[1] });
  for (const x of alongX) for (const dir of [-1, 1]) raw.push({ axis: 'z', c: x - dir * halfLane, dir, min: extentZ[0], max: extentZ[1] });
  return raw.map((l) => {
    const span = l.max - l.min;
    const toU = (s) => (l.dir > 0 ? s - l.min : l.max - s);
    const stops = crossingsFor(l.axis)
      .map(({ c, half }) => ({ u: toU(c) - half - STOP_BACK, clear: toU(c) + half }))
      .filter((s) => s.u > 0 && s.clear < span)
      .sort((a, b) => a.u - b.u);
    return { ...l, span, stops };
  });
}

/** World position along the lane's axis for lane coordinate u. */
export const laneS = (lane, u) => (lane.dir > 0 ? lane.min + u : lane.max - u);

/** IDM acceleration toward desired speed v0, following an obstacle `gap` metres ahead moving at vLead. */
export function idm(v, v0, gap, vLead) {
  const free = 1 - (v / v0) ** 4;
  if (gap === Infinity) return CAR.accel * free;
  const sStar = CAR.minGap + Math.max(0, v * CAR.headway + (v * (v - vLead)) / (2 * Math.sqrt(CAR.accel * CAR.brake)));
  return CAR.accel * (free - (sStar / Math.max(gap, 0.1)) ** 2);
}

/**
 * The next stop line ahead of the car's front that it must respect (red, and still able to stop).
 * car.next caches the index of the first stop line not yet passed, so the search is O(1) amortised.
 */
function redStopAhead(car, front, green) {
  const stops = car.lane.stops;
  while (car.next < stops.length && stops[car.next].u - front < -0.5) car.next++;
  if (green || car.next >= stops.length) return null;
  const s = stops[car.next];
  const d = s.u - front;
  if (d > CAR.lookAhead) return null;
  // committed: too close to stop comfortably (amber rule) → carry on through
  if (d < (car.v * car.v) / (2 * CAR.hardBrake)) return null;
  return s;
}

/**
 * @param {number} count total cars
 * @param {number} [seed]
 */
export function createTrafficSim(count, seed = 2024) {
  const r = rng(seed);
  const lanes = buildLanes();
  const total = lanes.reduce((a, l) => a + l.span, 0);
  const slot = CAR.length + CAR.minGap + 3;
  const cars = [];
  let left = count;
  lanes.forEach((lane, li) => {
    const want = li === lanes.length - 1 ? left : Math.round((count * lane.span) / total);
    const n = Math.max(0, Math.min(left, want, Math.floor(lane.span / slot)));
    left -= n;
    const spacing = lane.span / Math.max(n, 1);
    lane.cars = [];
    for (let k = 0; k < n; k++) {
      const car = { lane, u: k * spacing + r() * Math.max(0, spacing - slot), v: 0, v0: 8 + r() * 6, a: 0, braking: 0, next: 0, id: cars.length };
      car.v = car.v0 * 0.6;
      lane.cars.push(car);
      cars.push(car);
    }
  });

  function stepLane(lane, dt, time) {
    const list = lane.cars;
    const n = list.length;
    const green = signalGreen(lane.axis, time);
    for (let i = 0; i < n; i++) {
      const car = list[i];
      const lead = n > 1 ? list[(i + 1) % n] : null;
      let gap = Infinity;
      let vLead = 0;
      if (lead) {
        gap = (lead.u - car.u + (i === n - 1 ? lane.span : 0)) - CAR.length;
        vLead = lead.v;
      }
      const stop = redStopAhead(car, car.u + CAR.length / 2, green);
      if (stop) {
        const g = stop.u - (car.u + CAR.length / 2);
        if (g < gap) {
          gap = g;
          vLead = 0;
        }
      }
      const a = Math.max(-CAR.hardBrake, idm(car.v, car.v0, gap, vLead));
      car.a = a;
    }
    for (const car of list) {
      car.v = Math.max(0, car.v + car.a * dt);
      car.u += car.v * dt;
      car.braking = car.a < -0.8 || car.v < 0.3 ? 1 : 0;
    }
    // wrap the lead car back to the start of the lane, keeping the list sorted by u
    while (list.length && list[list.length - 1].u >= lane.span) {
      const car = list.pop();
      car.u -= lane.span;
      car.next = 0;
      list.unshift(car);
    }
  }

  return {
    cars,
    lanes,
    step(dt, time) {
      let left = Math.min(dt, 0.25);
      let t = time - left;
      while (left > 1e-6) {
        const h = Math.min(MAX_STEP, left);
        t += h;
        for (const lane of lanes) if (lane.cars.length) stepLane(lane, h, t);
        left -= h;
      }
    },
    /** World [x, z] and heading yaw of a car. */
    pose(car) {
      const s = laneS(car.lane, car.u);
      const L = car.lane;
      const yaw = L.axis === 'x' ? (L.dir > 0 ? 0 : Math.PI) : L.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      return L.axis === 'x' ? [s, L.c, yaw] : [L.c, s, yaw];
    },
  };
}
