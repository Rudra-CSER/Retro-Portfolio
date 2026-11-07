import { useEffect, useRef } from 'react';
import { finePointer, prefersReduced } from '../lib/motion';

const INTERACTIVE = 'a, button, [data-cursor], label, summary, select';

/**
 * A pixel dot + a 4-bracket targeting reticle. The reticle trails with easing,
 * stretches with velocity, and snaps around whatever you hover — like a
 * 16-bit selection box. Hidden on touch devices.
 */
export default function Cursor() {
  const dot = useRef(null);
  const ret = useRef(null);

  useEffect(() => {
    if (!finePointer) return;
    document.documentElement.classList.add('has-cursor');
    const m = { x: innerWidth / 2, y: innerHeight / 2, vx: 0, vy: 0, seen: false };
    const p = { x: m.x, y: m.y, w: 34, h: 34, rot: 0, sx: 1, sy: 1 };
    let target = null;
    let hidden = false;
    let raf = 0;
    const ease = prefersReduced ? 1 : 0.2;

    const move = (e) => {
      m.vx = e.clientX - m.x;
      m.vy = e.clientY - m.y;
      m.x = e.clientX;
      m.y = e.clientY;
      if (!m.seen) {
        m.seen = true;
        p.x = m.x;
        p.y = m.y;
        dot.current.style.opacity = 1;
        ret.current.style.opacity = 1;
      }
    };
    const over = (e) => {
      const el = e.target.closest?.(INTERACTIVE);
      const text = e.target.closest?.('input, textarea, [contenteditable]');
      hidden = !!text;
      // data-cursor="free": clickable, but too big to box (e.g. the intro's full-screen START)
      target = text || el?.dataset?.cursor === 'free' ? null : el;
      ret.current.classList.toggle('is-target', !!target);
      ret.current.classList.toggle('is-hidden', hidden);
    };
    const down = () => ret.current.classList.add('is-down');
    const up = () => ret.current.classList.remove('is-down');
    const leave = () => {
      dot.current.style.opacity = 0;
      ret.current.style.opacity = 0;
      m.seen = false;
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      dot.current.style.transform = `translate3d(${m.x}px, ${m.y}px, 0)`;
      let tx = m.x;
      let ty = m.y;
      let tw = 34;
      let th = 34;
      if (target && target.isConnected) {
        const r = target.getBoundingClientRect();
        tx = r.left + r.width / 2;
        ty = r.top + r.height / 2;
        tw = Math.min(r.width + 16, 640);
        th = Math.min(r.height + 14, 360);
      }
      p.x += (tx - p.x) * ease;
      p.y += (ty - p.y) * ease;
      p.w += (tw - p.w) * 0.22;
      p.h += (th - p.h) * 0.22;
      // velocity stretch (only when free-floating)
      const speed = Math.min(Math.hypot(m.vx, m.vy), 60);
      const stretch = target ? 0 : speed / 140;
      p.sx += (1 + stretch - p.sx) * 0.2;
      p.sy += (1 - stretch * 0.6 - p.sy) * 0.2;
      if (speed > 2 && !target) p.rot = Math.atan2(m.vy, m.vx);
      m.vx *= 0.82;
      m.vy *= 0.82;
      const rot = target ? 0 : p.rot;
      ret.current.style.width = `${p.w}px`;
      ret.current.style.height = `${p.h}px`;
      ret.current.style.transform = `translate3d(${p.x - p.w / 2}px, ${p.y - p.h / 2}px, 0) rotate(${rot}rad) scale(${p.sx}, ${p.sy}) rotate(${-rot}rad)`;
    };

    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerover', over, { passive: true });
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    document.documentElement.addEventListener('pointerleave', leave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerover', over);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      document.documentElement.removeEventListener('pointerleave', leave);
      document.documentElement.classList.remove('has-cursor');
    };
  }, []);

  if (!finePointer) return null;
  return (
    <>
      <div ref={ret} className="cursor-reticle" aria-hidden="true" style={{ opacity: 0 }}>
        <i />
        <i />
        <i />
        <i />
      </div>
      <div ref={dot} className="cursor-dot" aria-hidden="true" style={{ opacity: 0 }} />
    </>
  );
}
