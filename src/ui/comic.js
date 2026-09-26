// Comic-inflected hit feedback: bold impact words + halftone flash, animated with anime.js v4.
import { animate, createTimeline } from 'animejs';

export function createComic(root, reducedMotion) {
  const words = root.querySelector('[data-impact-words]');
  const halftone = root.querySelector('[data-halftone]');

  function word(text, { x = 50, y = 42, color = '#ffd23f', size = 1, tilt = -8 } = {}) {
    const el = document.createElement('span');
    el.className = 'impact-word';
    el.textContent = text;
    el.setAttribute('aria-hidden', 'true');
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    el.style.setProperty('--c', color);
    el.style.fontSize = `calc(${size} * clamp(3.2rem, 11vw, 10rem))`;
    words.appendChild(el);
    const tl = createTimeline({ onComplete: () => el.remove() });
    if (reducedMotion) {
      tl.add(el, { opacity: [0, 1], duration: 250, ease: 'linear' }).add(el, { opacity: 0, duration: 500, delay: 700 });
    } else {
      tl.add(el, { scale: [0.2, 1.15], rotate: [tilt - 14, tilt], opacity: [0, 1], duration: 260, ease: 'outBack(2.2)' })
        .add(el, { scale: 1.0, duration: 160, ease: 'outQuad' })
        .add(el, { opacity: 0, scale: 1.25, translateY: -30, duration: 480, delay: 520, ease: 'inQuad' });
    }
    return el;
  }

  function flash(strength = 1) {
    halftone.style.opacity = '0';
    animate(halftone, {
      opacity: [Math.min(0.5, 0.3 * strength), 0],
      scale: reducedMotion ? 1 : [1.08, 1],
      duration: reducedMotion ? 500 : 700,
      ease: 'outQuad',
    });
  }

  return { word, flash };
}
