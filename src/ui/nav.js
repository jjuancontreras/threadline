// Chapter nav rail + keyboard navigation (1–5 chapters, F free swing, M sound).

export function createNav(root, { onChapter, onFreeSwing, onSound }) {
  const rail = root.querySelector('[data-nav]');
  const buttons = [...rail.querySelectorAll('[data-goto]')];
  const free = rail.querySelector('[data-free]');

  buttons.forEach((b) => b.addEventListener('click', () => onChapter(Number(b.dataset.goto))));
  free.addEventListener('click', () => onFreeSwing());

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-5]$/.test(e.key)) {
      e.preventDefault();
      onChapter(Number(e.key) - 1);
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      onFreeSwing();
    } else if (e.key === 'm' || e.key === 'M') {
      onSound();
    }
  });

  return {
    setActive(i) {
      buttons.forEach((b, k) => {
        const on = k === Math.min(i, 4);
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      });
    },
    unlockFree() {
      free.disabled = false;
      free.classList.add('unlocked');
      free.setAttribute('aria-label', 'Free swing mode (F)');
    },
    setFreeActive(on) {
      free.classList.toggle('active', on);
    },
  };
}
