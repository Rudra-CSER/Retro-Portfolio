// Minecraft-style block hover for the pixel wordmarks (.pixeltext): the blocks under the
// mouse pop up and light up, the ones around them lift a little. One listener for the page.
import { finePointer, prefersReduced } from './motion';

export function initPixelHover() {
  if (prefersReduced || !finePointer) return;
  let svg = null;
  let lit = [];
  let raf = 0;
  let mx = 0;
  let my = 0;

  const clear = () => {
    for (const r of lit) r.classList.remove('mc-up', 'mc-up2');
    lit = [];
  };

  // Block centres come from the SVG's own coordinates (one layout read per frame),
  // so the lifted blocks never feed back into the distances.
  const apply = () => {
    raf = 0;
    clear();
    const m = svg?.isConnected ? svg.getScreenCTM() : null;
    const rects = m ? svg.querySelectorAll('rect') : [];
    if (!rects.length) return;
    const cell = Math.max(4, rects[0].width.baseVal.value * m.a); // one block's width on screen
    const near = cell * 1.1;
    const around = cell * 2.6;
    for (const r of rects) {
      const cx = r.x.baseVal.value + r.width.baseVal.value / 2;
      const cy = r.y.baseVal.value + r.height.baseVal.value / 2;
      const d = Math.hypot(m.a * cx + m.c * cy + m.e - mx, m.b * cx + m.d * cy + m.f - my);
      if (d <= near) r.classList.add('mc-up');
      else if (d <= around) r.classList.add('mc-up2');
      else continue;
      lit.push(r);
    }
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      const target = e.target.closest?.('.pixeltext svg') || null;
      if (target !== svg) {
        clear();
        svg = target;
      }
      if (!svg) return;
      mx = e.clientX;
      my = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    clear();
    svg = null;
  });
}
