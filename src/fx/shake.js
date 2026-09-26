// Trauma-based camera shake (Squirrel Eiserloh, GDC 2016 "Math for Game Programmers").
// Disabled entirely under prefers-reduced-motion.

export function createShake(enabled) {
  let trauma = 0;
  let t = 0;
  const n = (s) => Math.sin(s * 1.7) * 0.6 + Math.sin(s * 3.1 + 1.3) * 0.4;
  return {
    add(amount) {
      if (enabled) trauma = Math.min(1, trauma + amount);
    },
    /** Set a sustained minimum (e.g. rope strain). */
    hold(amount) {
      if (enabled) trauma = Math.max(trauma, amount);
    },
    /** Returns [dx, dy, droll] and decays trauma. */
    update(dt) {
      t += dt * 28;
      trauma = Math.max(0, trauma - dt * 1.4);
      const s = trauma * trauma;
      return [n(t) * s * 1.2, n(t + 41) * s * 1.0, n(t + 77) * s * 0.05];
    },
    get trauma() {
      return trauma;
    },
  };
}
