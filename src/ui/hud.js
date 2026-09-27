// HUD: speed/altitude readouts, chapter tag, threat alert, rescue meter, banners.
import { animate, stagger } from 'animejs';

export function createHud(root, reducedMotion) {
  const q = (s) => root.querySelector(s);
  const speed = q('[data-speed]');
  const alt = q('[data-alt]');
  const tag = q('[data-chapter-tag]');
  const alert = q('[data-alert]');
  const meter = q('[data-rescue-meter]');
  const gap = q('[data-gap]');
  const skip = q('[data-rescue-skip]');
  const pips = [...root.querySelectorAll('[data-pip]')];
  const saved = q('[data-saved]');
  const slowmo = q('[data-slowmo]');
  const hint = q('[data-freeswing-hint]');
  const prompt = q('[data-action-prompt]');
  const promptLabel = q('[data-action-label]');
  let lastPrompt = null;
  const call = q('.rescue-call');
  let lastSpeed = -1;
  let lastAlt = -1;

  return {
    readout(kmh, meters) {
      const s = Math.round(kmh);
      const a = Math.round(meters);
      if (s !== lastSpeed) speed.textContent = String(s).padStart(3, '0');
      if (a !== lastAlt) alt.textContent = String(a).padStart(3, '0');
      lastSpeed = s;
      lastAlt = a;
    },
    chapter(label) {
      if (tag.textContent !== label) tag.textContent = label;
    },
    alert(on) {
      if (on === !alert.hidden) return;
      alert.hidden = !on;
      if (on) {
        animate(alert, {
          opacity: reducedMotion ? [0, 1] : [0, 1, 0.3, 1, 0.4, 1],
          translateY: reducedMotion ? 0 : [-20, 0],
          duration: 900,
          ease: 'outQuad',
        });
      }
    },
    slowmo(k) {
      slowmo.hidden = k < 0.05;
      if (!slowmo.hidden) slowmo.textContent = `TIME ×${(1 - k * 0.88).toFixed(2)}`;
    },
    rescue(state) {
      meter.hidden = !state;
      if (!state) return;
      gap.textContent = `${state.gap.toFixed(2)} m`;
      call.textContent = state.saved ? 'THE LINE HOLDS' : 'TAP THE GLOWING ANCHORS';
      skip.hidden = state.saved;
      pips.forEach((p, i) => p.classList.toggle('on', i < state.anchored));
    },
    saved(on) {
      if (on === !saved.hidden) return;
      saved.hidden = !on;
      if (on) {
        const letters = saved.querySelectorAll('.saved-letter');
        animate(letters, {
          opacity: [0, 1],
          translateY: reducedMotion ? 0 : [40, 0],
          rotate: reducedMotion ? 0 : { from: () => (Math.random() - 0.5) * 30, to: 0 },
          delay: stagger(45),
          duration: 700,
          ease: 'outBack(1.6)',
        });
      }
    },
    freeSwingHint(on) {
      hint.hidden = !on;
      if (!on) this.prompt(null);
    },
    /** Context action prompt ("E · PIPE RUN"), or null to hide. */
    prompt(label) {
      if (label === lastPrompt) return;
      lastPrompt = label;
      prompt.hidden = !label;
      if (label) promptLabel.textContent = label;
    },
  };
}
