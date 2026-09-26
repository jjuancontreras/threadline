// On-screen run pad for free mode on touch screens: steer/run on the left, jump + web on the right.
// Buttons carry data-ui so a press never doubles as a tap-to-fire on the canvas.
const PAD = [
  { key: 'l', label: '◀', name: 'Turn left', side: 'left' },
  { key: 'f', label: '▲', name: 'Run forward', side: 'left' },
  { key: 'r', label: '▶', name: 'Turn right', side: 'left' },
  { key: 'u', label: 'JUMP', name: 'Jump', side: 'right' },
  { key: 'e', label: 'WEB', name: 'Fire web ahead', side: 'right' },
];

/**
 * @param {HTMLElement} root overlay element
 * @param {(key: string, down: boolean) => void} press free-swing control input
 */
export function createTouchPad(root, press) {
  const pad = document.createElement('div');
  pad.className = 'touchpad';
  pad.setAttribute('aria-hidden', 'true'); // keyboard users have WASD / E; this is a touch affordance
  const sides = { left: document.createElement('div'), right: document.createElement('div') };
  sides.left.className = 'touchpad-side touchpad-left';
  sides.right.className = 'touchpad-side touchpad-right';
  for (const b of PAD) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.tabIndex = -1;
    btn.dataset.ui = '';
    btn.dataset.pad = b.key;
    btn.title = b.name;
    btn.textContent = b.label;
    const down = (e) => {
      e.preventDefault();
      btn.setPointerCapture?.(e.pointerId);
      btn.classList.add('on');
      press(b.key, true);
    };
    const up = () => {
      btn.classList.remove('on');
      press(b.key, false);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    sides[b.side].appendChild(btn);
  }
  pad.append(sides.left, sides.right);
  root.appendChild(pad);
  return pad;
}
