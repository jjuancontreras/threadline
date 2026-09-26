// Story vs. free-swing mode, and the rescue latch: once the climax starts it owns the frame
// (scroll locked on chapter 5) until the train is saved or the reader jumps elsewhere.
const RESCUE = 4;
const OUTRO = 5;
const LATCH_P = 0.002; // land firmly inside chapter 5 before locking

/**
 * @param {{scroll: object, hud: object, free: object, html: HTMLElement, hooks: object, isSaved: () => boolean}} deps
 */
export function createModes({ scroll, hud, free, html, hooks, isSaved }) {
  let nav = null;
  let freeUnlocked = false;
  let freeOn = false;
  let latched = false;

  function unlatch() {
    if (!latched) return;
    latched = false;
    scroll.lock(false);
  }

  const modes = {
    get freeOn() {
      return freeOn;
    },
    /** The nav is built after the modes (it needs their callbacks). */
    bindNav(n) {
      nav = n;
    },
    onSaved() {
      html.dataset.rescue = 'saved';
      hooks.rescue = 'saved';
      hud.saved(true);
      freeUnlocked = true;
      nav?.unlockFree();
      scroll.lock(false);
    },
    enterFree() {
      if (!freeUnlocked || freeOn) return;
      freeOn = true;
      html.classList.add('free-mode');
      scroll.lock(true);
      free.enter();
      hud.freeSwingHint(true);
      hud.saved(false);
      nav?.setFreeActive(true);
    },
    exitFree() {
      if (!freeOn) return;
      freeOn = false;
      free.exit();
      html.classList.remove('free-mode');
      hud.freeSwingHint(false);
      nav?.setFreeActive(false);
      scroll.lock(false);
      scroll.goto(OUTRO, 0.9, true);
    },
    toggleFree() {
      if (freeOn) modes.exitFree();
      else modes.enterFree();
    },
    /** Rail / keyboard chapter jump. */
    gotoChapter(i) {
      if (freeOn) modes.exitFree();
      if (i !== RESCUE) unlatch();
      scroll.goto(i, i === 0 ? 0 : 0.001);
    },
    /**
     * Per frame: engage/release the rescue latch and return the chapter to render.
     * @returns {{index: number, p: number}}
     */
    resolve(index, p) {
      if (index === RESCUE && !isSaved() && !latched && !freeOn) {
        latched = true;
        scroll.goto(RESCUE, LATCH_P, true);
        scroll.lock(true);
      }
      if (latched && isSaved()) latched = false;
      return latched ? { index: RESCUE, p: LATCH_P } : { index, p };
    },
  };
  return modes;
}
