// Self-hosted OFL fonts, woff2 only (every browser with WebGL2-era support reads woff2),
// so the build doesn't ship the unused .woff fallbacks that @fontsource's CSS references.
import anton from '@fontsource/anton/files/anton-latin-400-normal.woff2?url';
import bangers from '@fontsource/bangers/files/bangers-latin-400-normal.woff2?url';
import grotesk from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?url';

const FACES = [
  ['Anton', anton],
  ['Bangers', bangers],
  ['Space Grotesk', grotesk],
];

/** Register the faces; text renders in the fallback stack until each one arrives (like font-display: swap). */
export function loadFonts(doc = document) {
  for (const [family, url] of FACES) {
    const face = new FontFace(family, `url(${url}) format('woff2')`, { weight: '400', style: 'normal', display: 'swap' });
    doc.fonts.add(face);
    face.load().catch((err) => console.warn(`[threadline] font ${family} failed to load`, err));
  }
}
