// Every scroll-progress beat of the story in one place. Values are chapter progress (0..1)
// unless noted; retime a chapter here instead of hunting through the chapter modules.

/** Chapter 3 — THREAT: slingshot onto the roof, twinkle, carrier arrival, drops. */
export const THREAT = {
  load: 0.06, // tethers stretch back
  launch: 0.17,
  land: 0.2,
  run: 0.25, // run to the roof edge
  twinkle: 0.27, // star in the sky
  arrive: 0.3, // carrier starts its approach
  docked: 0.42,
  drop: 0.44, // main bay opens, GANTRY falls
  impact: 0.52,
};

/** Chapter 3 — when each background squad unit leaves its bay. */
export const SQUAD_DROPS = [0.47, 0.5, 0.55, 0.58, 0.62, 0.66];

/** Chapter 4 — IMPACT story clock, in seconds of story time (see storyTime). */
export const IMPACT = { release: 2.0, flight: 1.1, total: 6.5 };

/** Epilogue — bay doors seal, THREADRUNNER zips away, the carrier lifts off. */
export const EPILOGUE = {
  doorsClose: [0.04, 0.22],
  heroFire: 0.28,
  heroLaunch: 0.34,
  heroGone: 0.6,
  shipDepart: [0.25, 0.95],
};
