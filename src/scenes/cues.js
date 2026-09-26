// One-shot story cues (a SFX, a comic word, a flash) that are scroll-reversible: a cue fires
// once when its window becomes active, re-arms when the window is left, and never fires
// while the reader is scrubbing backwards.

export function createCues() {
  const armed = new Set();
  return {
    /**
     * @param {string} key unique cue id
     * @param {boolean} active whether the cue's window is active this frame
     * @param {boolean} scrubbingBack true when the reader is scrolling backwards
     * @param {() => void} fn effect to run on entry
     * @returns {boolean} whether fn ran this frame
     */
    cue(key, active, scrubbingBack, fn) {
      if (!active) {
        armed.delete(key);
        return false;
      }
      if (armed.has(key)) return false;
      armed.add(key);
      if (scrubbingBack) return false;
      fn();
      return true;
    },
  };
}
