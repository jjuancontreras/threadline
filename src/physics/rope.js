// Visual tether: a Verlet particle chain pinned at both ends, relaxed with
// iterative distance constraints. This runs every frame for every visible tether,
// so it deliberately works in-place on typed arrays (the one exception to the
// project's immutability rule — allocation per frame would thrash the GC).

export function createRope(segments = 18) {
  const n = segments + 1;
  return { n, pos: new Float32Array(n * 3), prev: new Float32Array(n * 3), ready: false };
}

function placeStraight(rope, a, b) {
  const { n, pos, prev } = rope;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    for (let k = 0; k < 3; k++) {
      pos[i * 3 + k] = a[k] + (b[k] - a[k]) * t;
      prev[i * 3 + k] = pos[i * 3 + k];
    }
  }
  rope.ready = true;
}

/**
 * @param rope rope from createRope
 * @param a start pin (hand) [x,y,z]
 * @param b end pin (anchor) [x,y,z]
 * @param dt seconds
 * @param slack 1 = taut, >1 = sagging rope
 * @param iterations constraint relaxation passes
 */
export function stepRope(rope, a, b, dt, slack = 1.0, iterations = 6, gravity = 9.8) {
  if (!rope.ready) placeStraight(rope, a, b);
  const { n, pos, prev } = rope;
  const span = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const rest = (span * slack) / (n - 1);
  const g = gravity * dt * dt;
  for (let i = 1; i < n - 1; i++) {
    const o = i * 3;
    for (let k = 0; k < 3; k++) {
      const cur = pos[o + k];
      const vel = (cur - prev[o + k]) * 0.96;
      prev[o + k] = cur;
      pos[o + k] = cur + vel - (k === 1 ? g : 0);
    }
  }
  for (let it = 0; it < iterations; it++) {
    pin(pos, 0, a);
    pin(pos, n - 1, b);
    for (let i = 0; i < n - 1; i++) relax(pos, i, rest, i === 0, i === n - 2);
  }
  pin(pos, 0, a);
  pin(pos, n - 1, b);
  return rope;
}

function pin(pos, i, p) {
  pos[i * 3] = p[0];
  pos[i * 3 + 1] = p[1];
  pos[i * 3 + 2] = p[2];
}

function relax(pos, i, rest, firstPinned, lastPinned) {
  const a = i * 3;
  const b = a + 3;
  const dx = pos[b] - pos[a];
  const dy = pos[b + 1] - pos[a + 1];
  const dz = pos[b + 2] - pos[a + 2];
  const d = Math.hypot(dx, dy, dz) || 1e-6;
  const diff = (d - rest) / d;
  const wa = firstPinned ? 0 : lastPinned ? 1 : 0.5;
  const wb = lastPinned ? 0 : firstPinned ? 1 : 0.5;
  pos[a] += dx * diff * wa;
  pos[a + 1] += dy * diff * wa;
  pos[a + 2] += dz * diff * wa;
  pos[b] -= dx * diff * wb;
  pos[b + 1] -= dy * diff * wb;
  pos[b + 2] -= dz * diff * wb;
}

/** Add a lateral vibration (rope strain) to interior points. */
export function vibrate(rope, amount, time) {
  const { n, pos } = rope;
  for (let i = 1; i < n - 1; i++) {
    const s = Math.sin((i / (n - 1)) * Math.PI);
    pos[i * 3 + 1] += Math.sin(time * 61 + i * 1.7) * amount * s;
    pos[i * 3 + 2] += Math.cos(time * 53 + i * 2.3) * amount * s;
  }
  return rope;
}
