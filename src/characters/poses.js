// THREADRUNNER pose library. Joint rotations are Euler [x, y, z] radians.
// Conventions (character faces +Z): +x on spine = lean forward, −x on hips/shoulders =
// limb swings forward, +x on knees = shin folds back, ±z on shoulders = arm raised sideways.

export const POSES = {
  stand: { spine: [0.05, 0, 0], shL: [0, 0, 0.12], shR: [0, 0, -0.12], elL: [-0.2, 0, 0], elR: [-0.2, 0, 0], hipL: [0, 0, 0.04], hipR: [0, 0, -0.04] },
  crouch: {
    spine: [0.75, 0, 0], head: [-0.55, 0, 0],
    shL: [-0.5, 0, 0.35], elL: [-0.9, 0, 0], shR: [-0.9, 0, -0.2], elR: [-0.6, 0, 0],
    hipL: [-1.9, 0, 0.18], knL: [2.3, 0, 0], hipR: [-1.2, 0, -0.2], knR: [2.4, 0, 0],
  },
  // perched on a corner: one knee down, hand on the ledge, looking out over the drop
  perch: {
    spine: [0.85, 0.15, 0], head: [-0.75, -0.2, 0],
    shL: [-1.1, 0, 0.25], elL: [-0.35, 0, 0], shR: [-0.25, 0, -0.45], elR: [-1.2, 0, 0],
    hipL: [-2.0, 0, 0.35], knL: [2.45, 0, 0], hipR: [-0.9, 0, -0.3], knR: [2.5, 0, 0],
  },
  // attached to a tether (right hand) through the bottom of the arc: web arm long overhead,
  // free arm flung out and back, torso twisted into the swing, knees tucked asymmetrically
  // (one drawn up to the chest, one trailing) — the classic comic-book swing silhouette
  swing: {
    spine: [0.42, -0.28, 0.08], head: [-0.6, 0.25, 0],
    shR: [-0.15, 0, -2.9], elR: [0, 0, 0.12], shL: [0.55, 0.2, 0.95], elL: [-0.45, 0, 0],
    hipL: [-1.55, 0, 0.18], knL: [2.05, 0, 0], hipR: [0.15, 0, -0.1], knR: [1.55, 0, 0],
  },
  // head-first free fall / dive between swings
  dive: {
    spine: [0.25, 0, 0], head: [-1.0, 0, 0],
    shL: [0.95, 0, 0.3], elL: [-0.15, 0, 0], shR: [0.95, 0, -0.3], elR: [-0.15, 0, 0],
    hipL: [0.1, 0, 0.06], knL: [0.25, 0, 0], hipR: [0.15, 0, -0.06], knR: [0.4, 0, 0],
  },
  fly: {
    spine: [0.3, 0, 0], head: [-0.6, 0, 0],
    shL: [0.5, 0, 0.5], elL: [-0.3, 0, 0], shR: [0.5, 0, -0.5], elR: [-0.3, 0, 0],
    hipL: [0.15, 0, 0.12], knL: [0.5, 0, 0], hipR: [-0.5, 0, -0.1], knR: [1.1, 0, 0],
  },
  tuck: {
    spine: [0.95, 0, 0], head: [-0.3, 0, 0],
    shL: [-1.25, 0, 0.3], elL: [-1.7, 0, 0], shR: [-1.25, 0, -0.3], elR: [-1.7, 0, 0],
    hipL: [-2.25, 0, 0.1], knL: [2.55, 0, 0], hipR: [-2.25, 0, -0.1], knR: [2.55, 0, 0],
  },
  spread: {
    spine: [0.1, 0, 0], head: [-0.2, 0, 0],
    shL: [0, 0, 1.55], elL: [0, 0, 0.1], shR: [0, 0, -1.55], elR: [0, 0, -0.1],
    hipL: [0, 0, 0.3], knL: [0.2, 0, 0], hipR: [0, 0, -0.3], knR: [0.35, 0, 0],
  },
  // firing a tether: right arm snapped out toward the anchor
  shoot: {
    spine: [0.15, 0, 0], head: [-0.25, 0, 0],
    shR: [-2.35, 0, -0.25], elR: [0, 0, 0], shL: [0.35, 0, 0.45], elL: [-0.6, 0, 0],
    hipL: [-0.5, 0, 0.1], knL: [0.9, 0, 0], hipR: [0.2, 0, -0.1], knR: [0.4, 0, 0],
  },
  // slingshot: both tethers in hand, stretched back like a bowstring
  pull: {
    spine: [-0.45, 0, 0], head: [0.2, 0, 0],
    shL: [-2.45, 0, 0.55], elL: [-0.2, 0, 0], shR: [-2.45, 0, -0.55], elR: [-0.2, 0, 0],
    hipL: [-1.25, 0, 0.15], knL: [1.1, 0, 0], hipR: [-1.05, 0, -0.15], knR: [1.3, 0, 0],
  },
  brace: {
    spine: [-0.35, 0, 0], head: [0.25, 0, 0],
    shL: [-1.45, 0, 0.25], elL: [-0.25, 0, 0], shR: [-1.45, 0, -0.25], elR: [-0.25, 0, 0],
    hipL: [-0.7, 0, 0.3], knL: [0.9, 0, 0], hipR: [0.35, 0, -0.3], knR: [0.4, 0, 0],
  },
  land: {
    spine: [0.6, 0, 0], head: [-0.4, 0, 0],
    shL: [-0.2, 0, 1.2], elL: [-0.4, 0, 0], shR: [-1.1, 0, -0.3], elR: [-0.3, 0, 0],
    hipL: [-1.5, 0, 0.35], knL: [2.0, 0, 0], hipR: [-0.4, 0, -0.35], knR: [2.3, 0, 0],
  },
  // mid-air "chill": lying back, hands behind the head, one knee up
  layback: {
    spine: [-0.55, 0, 0], head: [0.4, 0, 0],
    shL: [-2.7, 0, 0.55], elL: [-2.2, 0, 0], shR: [-2.7, 0, -0.55], elR: [-2.2, 0, 0],
    hipL: [-1.35, 0, 0.12], knL: [1.7, 0, 0], hipR: [-0.55, 0, -0.2], knR: [0.35, 0, 0],
  },
  // scissor kick: lead leg thrown forward, trail leg back, arms counter-balancing
  scissor: {
    spine: [0.2, 0.3, 0], head: [-0.3, -0.3, 0],
    shL: [0.45, 0, 1.3], elL: [-0.3, 0, 0], shR: [-0.95, 0, -1.1], elR: [-0.4, 0, 0],
    hipL: [-1.5, 0, 0.12], knL: [0.2, 0, 0], hipR: [0.9, 0, -0.12], knR: [0.7, 0, 0],
  },
  // bases for the procedural locomotion cycle (gait adds the leg/arm swing)
  walk: { spine: [0.08, 0, 0], head: [-0.06, 0, 0], shL: [0, 0, 0.1], shR: [0, 0, -0.1] },
  run: { spine: [0.46, 0, 0], head: [-0.42, 0, 0], shL: [0, 0, 0.14], shR: [0, 0, -0.14] },
  // charging a super jump: sunk low, fingertips near the ground, weight loaded
  charge: {
    spine: [0.95, 0, 0], head: [-0.85, 0, 0],
    shL: [-0.35, 0, 0.55], elL: [-0.25, 0, 0], shR: [-0.35, 0, -0.55], elR: [-0.25, 0, 0],
    hipL: [-2.15, 0, 0.32], knL: [2.6, 0, 0], hipR: [-2.1, 0, -0.32], knR: [2.6, 0, 0],
  },
};

const MIRROR = { shL: 'shR', shR: 'shL', elL: 'elR', elR: 'elL', hipL: 'hipR', hipR: 'hipL', knL: 'knR', knR: 'knL' };

/** Mirror a pose across the body's mid-plane: swap left/right joints and flip y/z rotations. */
export function mirrorPose(pose) {
  const out = {};
  for (const [name, [x, y, z]] of Object.entries(pose)) out[MIRROR[name] || name] = [x, -y, -z];
  return out;
}

// left-hand variants for tethers fired from the left
POSES.swingL = mirrorPose(POSES.swing);
POSES.shootL = mirrorPose(POSES.shoot);

const smooth = (a, b, v) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * Metres covered per full gait cycle (two steps) at ground speed v, for THREADRUNNER's long legs:
 * about 3 m walking, growing to 10 m bounding strides at a flat-out sprint.
 */
export function strideLength(v) {
  return 2.9 + 7.4 * smooth(3, 26, v);
}

/** Gait phase advance in rad/s at ground speed v (feet stay planted: speed / stride). */
export function gaitRate(v) {
  return v <= 0 ? 0 : (Math.PI * 2 * v) / strideLength(v);
}

/**
 * Additive locomotion cycle. phase in radians (left foot plants at 0), amount 0..1 fades the
 * cycle in from standing, run 0..1 blends a calm heel-to-toe walk into a bounding sprint
 * (bigger leg swing, high heel recovery, pumping bent arms, counter-twisting torso).
 */
export function gaitOffsets(phase, amount, run = 0) {
  const a = amount;
  const w = 1 - run;
  const leg = (s, c) => [
    (w * (-0.42 * s - 0.02) + run * (-1.1 * s - 0.28)) * a,
    (w * (0.08 + 0.85 * Math.max(0, c) ** 1.6) + run * (0.3 + 2.0 * Math.max(0, c) ** 0.7)) * a,
  ];
  const arm = (s) => [
    (w * 0.38 + run * 1.0) * s * a,
    (w * (-0.35 - 0.2 * Math.max(0, -s)) + run * (-1.55 - 0.3 * Math.max(0, -s))) * a,
  ];
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const [hipL, knL] = leg(s, c);
  const [hipR, knR] = leg(-s, -c);
  const [shL, elL] = arm(s);
  const [shR, elR] = arm(-s);
  return {
    hipL: [hipL, 0, 0],
    hipR: [hipR, 0, 0],
    knL: [knL, 0, 0],
    knR: [knR, 0, 0],
    shL: [shL, 0, 0],
    shR: [shR, 0, 0],
    elL: [elL, 0, 0],
    elR: [elR, 0, 0],
    spine: [0, (w * 0.06 + run * 0.16) * s * a, 0],
    bounce: (w * 0.03 * Math.cos(2 * phase) + run * (0.1 * Math.abs(s) - 0.03)) * a,
  };
}
