// Free-mode day/night clock. One full cycle (sunrise → noon → sunset → night → sunrise) takes
// DAY.period seconds. Everything that lights the city reads the same four numbers:
//   day     0..1  daylight on the city (sun + blue sky)
//   golden  0..1  sunrise/sunset warmth (peaks with the sun on the horizon)
//   lights  0..1  artificial light: windows, street lamps, headlight pools (the old "night")
//   sunDir  unit vector toward the sun (below the horizon at night); moonDir opposite
const TAU = Math.PI * 2;

export const DAY = { period: 240, startPhase: 0.9 }; // 4 minutes; free mode starts just before dawn

const smooth = (a, b, v) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * @param {number} phase 0..1 (0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight)
 * @returns {{phase:number, elevation:number, day:number, golden:number, lights:number, sunDir:number[], moonDir:number[]}}
 */
export function skyAt(phase) {
  const p = ((phase % 1) + 1) % 1;
  const a = p * TAU;
  const elevation = Math.sin(a); // -1..1
  // the sun crosses the sky from the east (+x) to the west (-x), tilted south (-z)
  const sun = [Math.cos(a), elevation, -0.35];
  const len = Math.hypot(...sun);
  const sunDir = sun.map((v) => v / len);
  const moon = [-sunDir[0], Math.max(0.25, -sunDir[1]), -sunDir[2] * 0.6];
  const mlen = Math.hypot(...moon);
  return {
    phase: p,
    elevation,
    day: smooth(0.02, 0.42, elevation),
    golden: Math.exp(-((elevation - 0.03) ** 2) / (2 * 0.17 * 0.17)) * smooth(-0.5, -0.05, elevation),
    lights: 1 - smooth(-0.18, 0.15, elevation),
    sunDir,
    moonDir: moon.map((v) => v / mlen),
  };
}

/** Sky state `seconds` into free mode. */
export function skyAtTime(seconds, period = DAY.period, startPhase = DAY.startPhase) {
  return skyAt(startPhase + seconds / period);
}

/** The story's authored look: permanent dusk→night driven by the chapter (no sun). */
export function storySky(night) {
  return { phase: 0.75, elevation: -1, day: 0, golden: 0, lights: night, sunDir: [0.3, -0.8, -0.5], moonDir: [-0.35, 0.55, -0.75] };
}
