import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

export { gsap, ScrollTrigger, SplitText };

const mq = (q) => typeof window !== 'undefined' && window.matchMedia(q).matches;
export const prefersReduced = mq('(prefers-reduced-motion: reduce)');
export const finePointer = mq('(hover: hover) and (pointer: fine)');
// Phones scroll natively: momentum + CSS scroll-snap feel better there than smoothed wheel scrolling.
export const nativeScrollDevice = mq('(pointer: coarse)') || mq('(max-width: 720px)');

export let lenis = null;
const locks = new Set();

export function initMotion() {
  if (lenis || prefersReduced || nativeScrollDevice) return;
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  if (locks.size) lenis.stop();
}

/** Reference-counted scroll lock (boot screen, pause menu, case file, game). */
export function lockScroll(reason) {
  locks.add(reason);
  document.documentElement.classList.add('is-locked');
  lenis?.stop();
}
export function unlockScroll(reason) {
  locks.delete(reason);
  if (locks.size) return;
  document.documentElement.classList.remove('is-locked');
  lenis?.start();
}

function nativeScroll(top, opts) {
  window.scrollTo({ top: Math.max(0, top), behavior: prefersReduced ? 'auto' : 'smooth' });
  if (opts.onComplete) setTimeout(opts.onComplete, prefersReduced ? 0 : 750);
}

export function scrollToTarget(target, opts = {}) {
  if (target === 0 || target === '#top') {
    if (lenis) lenis.scrollTo(0, { duration: 1.6, ...opts });
    else nativeScroll(0, opts);
    return;
  }
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  if (lenis) {
    lenis.scrollTo(el, { duration: 1.6, offset: 0, ...opts });
    return;
  }
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  nativeScroll(el.getBoundingClientRect().top + window.scrollY + (opts.offset ?? -margin), opts);
}

export function scrollToY(y, opts = {}) {
  if (lenis) lenis.scrollTo(y, { duration: 1.2, ...opts });
  else nativeScroll(y, opts);
}
