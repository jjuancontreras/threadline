// Aerial acrobatics layer: generic gymnastics moves (flips, corkscrews, twirls) expressed
// as an extra world-space rotation about the hero's pelvis plus pose weights. Pure math.
import { vNorm, vCross, easeInOutCubic, clamp } from '../core/math.js';

export const TRICKS = ['frontflip', 'corkscrew', 'twirl', 'backflip', 'corkscrew'];

/**
 * @param {string} kind trick name
 * @param {number} k progress through the trick, 0..1
 * @param {number[]} vdir travel direction (normalized)
 * @returns {{axis:number[], angle:number, weights:Record<string, number>}}
 */
export function trickAt(kind, k, vdir) {
  const u = clamp(k);
  const e = easeInOutCubic(u);
  const bell = Math.sin(u * Math.PI);
  const flat = vNorm([vdir[0], 0, vdir[2]]);
  const right = vNorm(vCross(flat, [0, 1, 0]));
  switch (kind) {
    case 'frontflip':
      return { axis: right, angle: -e * Math.PI * 2, weights: { tuck: bell, dive: 1 - bell } };
    case 'backflip':
      return { axis: right, angle: e * Math.PI * 2, weights: { tuck: bell * 0.8, spread: bell * 0.2, fly: 1 - bell } };
    case 'corkscrew':
      return { axis: vNorm(vdir), angle: e * Math.PI * 4, weights: { dive: 1 - bell * 0.5, spread: bell * 0.5 } };
    case 'twirl':
    default:
      return { axis: [0, 1, 0], angle: e * Math.PI * 4, weights: { spread: bell, fly: 1 - bell } };
  }
}

/** Which slice of a flight segment the trick occupies (leaves room to exit and re-aim). */
export function trickWindow(segmentProgress) {
  return clamp((segmentProgress - 0.12) / 0.6);
}
