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
  // attached to a tether and diving forward through the bottom of the arc
  swing: {
    spine: [0.55, 0, 0], head: [-0.65, 0, 0],
    shR: [0, 0, -2.95], elR: [0, 0, 0.1], shL: [0.75, 0, 0.55], elL: [-0.5, 0, 0],
    hipL: [0.45, 0, 0.12], knL: [1.3, 0, 0], hipR: [-0.55, 0, -0.1], knR: [0.9, 0, 0],
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
  // base for the procedural run cycle (gait adds the leg/arm swing)
  run: { spine: [0.32, 0, 0], head: [-0.3, 0, 0], elL: [-1.35, 0, 0], elR: [-1.35, 0, 0], shL: [0, 0, 0.12], shR: [0, 0, -0.12] },
};

/** Additive run/walk cycle. phase in radians; amount 0..1 (walk ≈ 0.5, sprint = 1). */
export function gaitOffsets(phase, amount) {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const a = amount;
  return {
    hipL: [(-s * 0.95 - 0.15) * a, 0, 0],
    hipR: [(s * 0.95 - 0.15) * a, 0, 0],
    knL: [Math.max(0, c) * 1.7 * a + 0.15 * a, 0, 0],
    knR: [Math.max(0, -c) * 1.7 * a + 0.15 * a, 0, 0],
    shL: [s * 0.9 * a, 0, 0],
    shR: [-s * 0.9 * a, 0, 0],
    bounce: Math.abs(Math.sin(phase)) * 0.06 * a,
  };
}
