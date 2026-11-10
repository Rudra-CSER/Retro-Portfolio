// Palette helpers for code that colours things itself (canvas, WebGL, GSAP-animated backgrounds).
// The palettes themselves are CSS variables in styles/base.css.

/** Palettes with a light page. */
export const LIGHT_PALETTES = ['white'];

export const isLightPalette = () => LIGHT_PALETTES.includes(document.documentElement.dataset.palette);

const hexRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbHex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

const PAPER = [241, 237, 228]; // --bg-0 of the WHITE palette

/**
 * A section background colour from content (dark project tints such as #0B1611), as it should
 * show in the current palette: unchanged on dark palettes, and on a light palette the same hue
 * as a pale wash over the paper.
 */
export function sceneBg(hex) {
  if (!hex || !isLightPalette()) return hex;
  const c = hexRgb(hex);
  const top = Math.max(...c, 1);
  const vivid = c.map((v) => (v / top) * 255); // the hue at full brightness
  return rgbHex(PAPER.map((p, i) => p * 0.88 + vivid[i] * 0.12));
}
