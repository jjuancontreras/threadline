// Chapter 1 title reveal: THREADLINE letters stagger in with anime.js v4.
import { animate, stagger } from 'animejs';

export function revealTitle(root, reducedMotion) {
  const title = root.querySelector('[data-title]');
  const word = title.querySelector('.title-word');
  const text = word.textContent.trim();
  word.setAttribute('aria-label', text);
  word.textContent = '';
  for (const ch of text) {
    const s = document.createElement('span');
    s.className = 'title-letter';
    s.textContent = ch;
    s.setAttribute('aria-hidden', 'true');
    word.appendChild(s);
  }
  const letters = word.querySelectorAll('.title-letter');
  const sub = title.querySelectorAll('.title-sub, .title-cue');
  if (reducedMotion) {
    animate([...letters, ...sub], { opacity: [0, 1], duration: 900, ease: 'linear' });
    return;
  }
  animate(letters, {
    opacity: [0, 1],
    translateY: ['0.6em', '0em'],
    rotateX: [-80, 0],
    filter: ['blur(12px)', 'blur(0px)'],
    delay: stagger(70, { start: 300 }),
    duration: 1100,
    ease: 'outExpo',
  });
  animate(sub, { opacity: [0, 1], translateY: [16, 0], delay: stagger(180, { start: 1300 }), duration: 900, ease: 'outQuad' });
}

/** Fade the title as chapter 1 progresses. */
export function titleProgress(root, visible) {
  const title = root.querySelector('[data-title]');
  title.style.opacity = String(visible);
  title.style.visibility = visible < 0.01 ? 'hidden' : 'visible';
}
