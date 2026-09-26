// Adaptive quality: pick a tier from device hints, then step down at runtime if FPS sags.

export const TIERS = {
  high: { density: 1, detail: 1, dprCap: 2, post: true, particles: 1, rain: true },
  medium: { density: 0.62, detail: 0.6, dprCap: 1.5, post: true, particles: 0.6, rain: true },
  low: { density: 0.32, detail: 0.3, dprCap: 1, post: false, particles: 0.35, rain: false },
};

export function detectQuality(win = window) {
  const params = new URLSearchParams(win.location.search);
  const forced = params.get('q');
  const coarse = win.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(win.innerWidth, win.innerHeight) < 600 || win.innerWidth < 760;
  const cores = win.navigator.hardwareConcurrency || 4;
  const mem = win.navigator.deviceMemory || 4;
  let tier = 'high';
  if (coarse || small) tier = 'medium';
  if (coarse && (cores <= 4 || mem <= 3)) tier = 'low';
  if (forced && TIERS[forced]) tier = forced;
  return { ...TIERS[tier], tier, locked: Boolean(forced) || params.has('lock'), mobile: coarse || small };
}

/**
 * Rolling-FPS monitor. Calls onDowngrade({dpr, post}) with the next cheaper setting
 * after the average stays under target for `patience` seconds.
 */
export function createMonitor(quality, initialDpr, onDowngrade) {
  const target = quality.mobile ? 28 : 42;
  const patience = 2.5;
  let dpr = initialDpr;
  let post = quality.post;
  let slow = 0;
  let avg = 60;
  let warm = 0;
  return {
    tick(dt) {
      if (quality.locked || dt <= 0) return;
      warm += dt;
      if (warm < 3) return; // ignore shader-compile hitches on start
      avg = avg * 0.95 + (1 / Math.min(dt, 0.25)) * 0.05;
      slow = avg < target ? slow + dt : 0;
      if (slow < patience) return;
      slow = 0;
      avg = 60;
      if (dpr > 1) dpr = Math.max(1, dpr - 0.5);
      else if (post) post = false;
      else return;
      onDowngrade({ dpr, post });
    },
    get fps() {
      return avg;
    },
  };
}
