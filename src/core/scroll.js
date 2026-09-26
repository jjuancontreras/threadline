// Lenis smooth scroll + mapping from scroll position to (chapter, progress).
import Lenis from 'lenis';

export const CHAPTERS = ['perch', 'swing', 'threat', 'impact', 'rescue', 'outro'];

export function createScroll(reducedMotion) {
  const lenis = new Lenis({
    autoRaf: false,
    smoothWheel: !reducedMotion,
    lerp: 0.075, // a touch heavier = silkier scrubbing of the scroll-driven shots
    wheelMultiplier: 0.85,
    syncTouch: !reducedMotion,
    syncTouchLerp: 0.08,
  });
  const sections = CHAPTERS.map((id) => document.getElementById(id));
  let tops = [];

  const measure = () => {
    tops = sections.map((s) => s.getBoundingClientRect().top + window.scrollY);
    tops.push(document.documentElement.scrollHeight - window.innerHeight + 1);
  };
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);

  /** @returns {{index:number, p:number}} */
  const locate = (y = lenis.scroll) => {
    let i = 0;
    while (i < CHAPTERS.length - 1 && y >= tops[i + 1]) i++;
    const span = Math.max(tops[i + 1] - tops[i], 1);
    return { index: i, p: Math.min(Math.max((y - tops[i]) / span, 0), 1) };
  };

  return {
    lenis,
    locate,
    measure,
    /** Scroll so that chapter `i` is at progress `p`. */
    goto(i, p = 0, immediate = false) {
      measure();
      const y = tops[i] + (tops[i + 1] - tops[i]) * p;
      lenis.scrollTo(Math.ceil(y), { immediate: immediate || reducedMotion, duration: 1.6, force: true, lock: false });
    },
    lock(on) {
      if (on) lenis.stop();
      else lenis.start();
    },
    raf(ms) {
      lenis.raf(ms);
    },
  };
}
