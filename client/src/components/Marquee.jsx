import { useLayoutEffect, useRef } from 'react';
import { gsap, prefersReduced, ScrollTrigger } from '../lib/motion';

/**
 * Infinite marquee. The track holds two copies of the items and loops by -50%.
 * Slows down on hover; optionally speeds up with scroll velocity.
 */
export default function Marquee({ children, speed = 40, reverse = false, velocity = false, className = '', label }) {
  const track = useRef(null);
  useLayoutEffect(() => {
    const el = track.current;
    if (!el || prefersReduced) return;
    const width = () => el.scrollWidth / 2;
    const dur = () => Math.max(8, width() / speed);
    const tw = gsap.fromTo(
      el,
      { x: reverse ? () => -width() : 0 },
      { x: reverse ? 0 : () => -width(), duration: dur(), ease: 'none', repeat: -1 },
    );
    let base = 1;
    let hover = 1;
    const apply = () => gsap.to(tw, { timeScale: base * hover, duration: 0.5, overwrite: true });
    const enter = () => {
      hover = 0.28;
      apply();
    };
    const leave = () => {
      hover = 1;
      apply();
    };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    let st = null;
    let settle = null;
    if (velocity) {
      st = ScrollTrigger.create({
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          base = 1 + Math.min(Math.abs(self.getVelocity()) / 350, 5);
          apply();
          settle?.kill();
          settle = gsap.delayedCall(0.18, () => {
            base = 1;
            apply();
          });
        },
      });
    }
    const ro = new ResizeObserver(() => tw.invalidate());
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? tw.play() : tw.pause()));
    io.observe(el);
    return () => {
      tw.kill();
      st?.kill();
      settle?.kill();
      ro.disconnect();
      io.disconnect();
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
    };
  }, [speed, reverse, velocity]);

  return (
    <div className={`marquee ${className}`} role={label ? 'region' : undefined} aria-label={label}>
      <div className="marquee-track" ref={track}>
        <div className="marquee-set">{children}</div>
        <div className="marquee-set" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
