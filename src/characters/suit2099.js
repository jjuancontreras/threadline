// Personal fan-art suit: Miguel O'Hara / Spider-Man 2099 (Across the Spider-Verse look).
// Blue-black bodysuit, skull-shaped red spider emblem front + back, red skull face design with
// glowing angular eyes, forearm spikes, talons, and tattered under-arm "web cape" membranes.
// Local, unpublished build — Spider-Man and Spider-Man 2099 are Marvel characters.
import * as THREE from 'three';

export const SUIT = {
  base: 0x0a0f22, // blue-black
  plate: 0x0d1430,
  red: '#e3121c',
  glow: new THREE.Color(2.6, 0.06, 0.08), // emissive red (bloom)
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function texture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** One skull-spider: domed head, pointed jaw, angular sockets, four legs per side. */
function drawSkullSpider(g, cx, cy, s, fill, socket) {
  g.save();
  g.translate(cx, cy);
  g.scale(s, s);
  g.fillStyle = fill;
  g.strokeStyle = fill;
  g.lineCap = 'round';
  // legs: two sweep up over the shoulders, two curl down around the ribs
  const legs = [
    [[-40, -30], [-120, -95], [-190, -150], 30],
    [[-48, -5], [-150, -40], [-235, -20], 26],
    [[-45, 20], [-150, 40], [-230, 110], 24],
    [[-35, 45], [-110, 110], [-170, 200], 22],
  ];
  for (const side of [1, -1]) {
    for (const [a, b, tip, w] of legs) {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(a[0] * side, a[1]);
      g.quadraticCurveTo(b[0] * side, b[1], tip[0] * side, tip[1]);
      g.stroke();
      // barbed tip
      g.beginPath();
      g.moveTo(tip[0] * side, tip[1] - w * 0.6);
      g.lineTo(tip[0] * side + side * -w * 1.4, tip[1] + w * 1.2);
      g.lineTo(tip[0] * side + side * w * 0.6, tip[1] + w * 0.5);
      g.fill();
    }
  }
  // skull: dome + cheekbones tapering to a pointed jaw
  g.beginPath();
  g.moveTo(0, -95);
  g.bezierCurveTo(70, -95, 88, -40, 78, 5);
  g.lineTo(55, 40);
  g.lineTo(30, 55);
  g.lineTo(12, 120);
  g.lineTo(0, 135);
  g.lineTo(-12, 120);
  g.lineTo(-30, 55);
  g.lineTo(-55, 40);
  g.lineTo(-78, 5);
  g.bezierCurveTo(-88, -40, -70, -95, 0, -95);
  g.fill();
  // eye sockets + nasal notch (cut back to suit colour)
  g.fillStyle = socket;
  for (const side of [1, -1]) {
    g.beginPath();
    g.moveTo(8 * side, -18);
    g.lineTo(62 * side, -40);
    g.lineTo(52 * side, 6);
    g.lineTo(14 * side, 12);
    g.closePath();
    g.fill();
  }
  g.beginPath();
  g.moveTo(0, 28);
  g.lineTo(9, 52);
  g.lineTo(-9, 52);
  g.closePath();
  g.fill();
  g.restore();
}

/** Torso wrap: u = 0.5 is the chest centre, u = 0 / 1 the spine (back emblem straddles the seam). */
export function emblemTextures() {
  const W = 1024;
  const H = 512;
  const [c, g] = canvas(W, H);
  const [e, ge] = canvas(W, H);
  const socketBase = '#0b1128';
  g.fillStyle = socketBase;
  g.fillRect(0, 0, W, H);
  // subtle vertical panel seams on the suit
  g.strokeStyle = 'rgba(80,100,170,0.18)';
  g.lineWidth = 2;
  for (let x = 0; x < W; x += 64) {
    g.beginPath();
    g.moveTo(x + 20, 0);
    g.lineTo(x, H);
    g.stroke();
  }
  drawSkullSpider(g, W / 2, 210, 0.95, SUIT.red, socketBase);
  drawSkullSpider(g, 0, 230, 0.75, SUIT.red, socketBase);
  drawSkullSpider(g, W, 230, 0.75, SUIT.red, socketBase);
  // emissive mask: same emblem, bright on black
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, W, H);
  drawSkullSpider(ge, W / 2, 210, 0.95, '#ff2a2a', '#000');
  drawSkullSpider(ge, 0, 230, 0.75, '#b01010', '#000');
  drawSkullSpider(ge, W, 230, 0.75, '#b01010', '#000');
  return { map: texture(c), emissive: texture(e) };
}

/** Face (front hemisphere): red skull mask markings + large angular glowing eyes. */
export function faceTextures() {
  const S = 512;
  const [c, g] = canvas(S, S);
  const [e, ge] = canvas(S, S);
  const eyes = (ctx, color) => {
    ctx.fillStyle = color;
    for (const side of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(256 + 14 * side, 250); // inner corner, low (angry slant)
      ctx.lineTo(256 + 118 * side, 196); // outer top
      ctx.lineTo(256 + 124 * side, 226);
      ctx.lineTo(256 + 70 * side, 282); // outer bottom
      ctx.lineTo(256 + 26 * side, 286);
      ctx.closePath();
      ctx.fill();
    }
  };
  g.clearRect(0, 0, S, S);
  // skull frame around the eyes: brow ridge, cheekbones, jaw lines to a point at the chin
  g.fillStyle = SUIT.red;
  g.beginPath();
  g.moveTo(256, 214);
  g.lineTo(256 + 150, 170);
  g.lineTo(256 + 150, 240);
  g.lineTo(256 + 96, 318);
  g.lineTo(256 + 40, 330);
  g.lineTo(256 + 22, 420);
  g.lineTo(256, 470);
  g.lineTo(256 - 22, 420);
  g.lineTo(256 - 40, 330);
  g.lineTo(256 - 96, 318);
  g.lineTo(256 - 150, 240);
  g.lineTo(256 - 150, 170);
  g.closePath();
  g.fill();
  // mouth "teeth" slits
  g.fillStyle = '#0b1128';
  for (let i = -2; i <= 2; i++) g.fillRect(256 + i * 12 - 3, 360, 6, 34 - Math.abs(i) * 6);
  eyes(g, '#ff4a3a');
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, S, S);
  // faint glow on the skull markings so the mask design reads in the dark
  ge.globalAlpha = 0.22;
  ge.drawImage(c, 0, 0);
  ge.globalAlpha = 1;
  eyes(ge, '#ff2b22');
  return { map: texture(c), emissive: texture(e) };
}

/** Face decal: front hemisphere slightly outside the helmet sphere. */
export function faceDecal(material) {
  const geo = new THREE.SphereGeometry(0.1335, 36, 24, 0, Math.PI, 0.2, Math.PI * 0.75);
  return new THREE.Mesh(geo, material);
}

/** Jagged forearm spikes (Across the Spider-Verse), pointing back toward the elbow. */
export function forearmSpikes(side, dark, glow) {
  const g = new THREE.Group();
  // [length, height along the forearm (elbow = 0, wrist ≈ -0.3)]
  [[0.13, -0.24], [0.11, -0.17], [0.08, -0.1]].forEach(([len, y], i) => {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.016, len, 5), i === 0 ? glow : dark);
    spike.position.set(side * 0.06, y, -0.01);
    // cone tips point +Y: tilt outward (away from the body) and back toward the elbow
    spike.rotation.set(0.2, 0, -side * (0.6 + i * 0.12));
    g.add(spike);
  });
  return g;
}

/** Three talons off a hand sphere. */
export function talons(dark) {
  const g = new THREE.Group();
  for (const k of [-1, 0, 1]) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.06, 4), dark);
    t.position.set(k * 0.022, -0.075, 0.02);
    t.rotation.x = Math.PI + 0.35;
    g.add(t);
  }
  return g;
}

/**
 * Cool blue fresnel sheen (the film's "blue-black" suit catching light at the edges).
 * Keeps the dark silhouette readable against a night sky.
 */
export function addRim(material, color = [0.06, 0.12, 0.34], power = 2.6) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = { value: color };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `uniform vec3 uRim;\nvoid main() {`)
      .replace(
        '#include <opaque_fragment>',
        `{
          float rimK = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), ${power.toFixed(2)});
          outgoingLight += uRim * rimK;
        }
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `rim-${color.join(',')}-${power}`;
  return material;
}
