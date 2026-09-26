// Clickable anchor targets for the rescue: real <button>s projected over 3D anchor points
// so they are keyboard-accessible and hit-testable on touch.
import * as THREE from 'three';

export function createRescueUI(root, anchors, onFire) {
  const layer = root.querySelector('[data-anchors]');
  const v = new THREE.Vector3();
  const buttons = anchors.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'anchor-btn';
    b.dataset.anchor = String(i);
    b.setAttribute('aria-label', `Fire tether to anchor ${i + 1}`);
    b.innerHTML = '<span class="anchor-ring"></span><span class="anchor-num">' + (i + 1) + '</span>';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onFire(i);
    });
    layer.appendChild(b);
    return b;
  });

  return {
    /** Position buttons each frame; hide the ones already anchored. */
    update(camera, visible, anchored) {
      layer.hidden = !visible;
      if (!visible) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      anchors.forEach((a, i) => {
        v.set(a[0], a[1], a[2]).project(camera);
        const onScreen = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        const b = buttons[i];
        b.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
        const done = anchored[i];
        b.classList.toggle('done', done);
        b.disabled = done;
        b.style.visibility = onScreen ? 'visible' : 'hidden';
      });
    },
  };
}
