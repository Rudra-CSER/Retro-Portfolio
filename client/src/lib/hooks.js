import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { gsap, finePointer, prefersReduced } from './motion';

export function useMedia(query) {
  const get = () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** Live clock for a time zone, ticking every second. */
export function useClock(timeZone = 'Asia/Kolkata') {
  const fmt = useMemo(
    () => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    [timeZone],
  );
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return fmt.format(now);
}

/** Calls back once when the element scrolls into view. */
export function useInView(ref, { threshold = 0.25, once = true, rootMargin = '0px' } = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) setInView(false);
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, once, rootMargin]);
  return inView;
}

// ── Magnetic pull ──────────────────────────────────────────────────────────
// One shared pointermove listener drives every registered element.
const magnets = new Set();
let listening = false;
function onMove(e) {
  for (const m of magnets) {
    if (!m.visible) continue;
    const el = m.el;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2 - m.x;
    const cy = r.top + r.height / 2 - m.y;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const reach = m.radius + Math.max(r.width, r.height) / 2;
    if (Math.hypot(dx, dy) < reach) {
      m.x = dx * m.strength;
      m.y = dy * m.strength;
      m.xTo(m.x);
      m.yTo(m.y);
      m.active = true;
    } else if (m.active) {
      m.x = 0;
      m.y = 0;
      m.xTo(0);
      m.yTo(0);
      m.active = false;
    }
  }
}

export function useMagnetic(ref, { strength = 0.32, radius = 80 } = {}) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !finePointer || prefersReduced) return;
    const m = {
      el,
      strength,
      radius,
      x: 0,
      y: 0,
      active: false,
      visible: false,
      xTo: gsap.quickTo(el, 'x', { duration: 0.7, ease: 'elastic.out(1, 0.45)' }),
      yTo: gsap.quickTo(el, 'y', { duration: 0.7, ease: 'elastic.out(1, 0.45)' }),
    };
    const io = new IntersectionObserver(([e]) => {
      m.visible = e.isIntersecting;
      if (!m.visible && m.active) {
        m.xTo(0);
        m.yTo(0);
        m.active = false;
      }
    });
    io.observe(el);
    magnets.add(m);
    if (!listening) {
      window.addEventListener('pointermove', onMove, { passive: true });
      listening = true;
    }
    return () => {
      io.disconnect();
      magnets.delete(m);
      gsap.set(el, { x: 0, y: 0 });
    };
  }, [ref, strength, radius]);
}

export const pad = (n, len = 6) => String(Math.max(0, Math.floor(n))).padStart(len, '0');

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
