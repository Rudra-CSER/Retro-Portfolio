import { useEffect, useRef } from 'react';
import { prefersReduced } from '../lib/motion';

/** Scanlines + aperture mask + vignette + animated static (the "film grain" of a CRT). */
export default function CRTOverlay() {
  const canvas = useRef(null);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c.getContext('2d', { alpha: true });
    if (!ctx) return undefined; // no 2D canvas: keep the scanlines, skip the grain
    const W = 160;
    const H = 90;
    c.width = W;
    c.height = H;
    const img = ctx.createImageData(W, H);
    let raf = 0;
    let last = 0;
    const draw = () => {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 66 || document.hidden) return;
      last = t;
      draw();
    };
    draw();
    // phones get no animated grain: it reads as a dirty screen at that size
    if (!prefersReduced && !window.matchMedia('(max-width: 720px)').matches) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="crt" aria-hidden="true">
      <canvas ref={canvas} className="crt-noise" />
      <div className="crt-lines" />
      <div className="crt-vignette" />
    </div>
  );
}
