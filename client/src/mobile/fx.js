import { gsap, prefersReduced } from '../lib/motion';

/**
 * Pixel assemble: every pixel of a TALLPIX title flies in from a scattered
 * position and locks into its glyph. Units are the SVG's own (1 = one pixel column).
 */
export function pixelAssemble(svg, { spread = 16, duration = 0.75, amount = 0.45, delay = 0, scrollTrigger } = {}) {
  if (!svg || prefersReduced) return gsap.timeline();
  const rects = svg.querySelectorAll('rect');
  return gsap.fromTo(
    rects,
    {
      x: () => gsap.utils.random(-spread, spread),
      y: () => gsap.utils.random(-spread * 1.2, spread * 0.6),
      opacity: 0,
    },
    {
      x: 0,
      y: 0,
      opacity: 1,
      duration,
      delay,
      ease: 'expo.out',
      stagger: { amount, from: 'random' },
      overwrite: true,
      scrollTrigger,
    },
  );
}

/**
 * Chapter entrance: the counter scrambles, the title assembles, the rule draws,
 * the kicker slides up, then anything marked [data-reveal] rises in.
 */
export function chapterIntro(root, { title = '.mch-title svg', start = 'top 80%' } = {}) {
  if (!root || prefersReduced) return null;
  const q = (s) => root.querySelector(s);
  const tl = gsap.timeline({ scrollTrigger: { trigger: root, start, once: true } });
  const no = q('.mch-no b');
  if (no) {
    tl.to(no, { duration: 0.9, scrambleText: { text: no.textContent, chars: '0123456789', revealDelay: 0.25, speed: 0.5 } }, 0);
  }
  const svg = title ? q(title) : null;
  if (svg) {
    gsap.set(svg.querySelectorAll('rect'), { opacity: 0 });
    tl.add(pixelAssemble(svg), 0.05);
  }
  const rule = q('.mch-rule');
  if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'expo.inOut' }, 0.1);
  const kick = root.querySelectorAll('.mch-kicker .mask-inner');
  if (kick.length) tl.fromTo(kick, { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'power4.out' }, 0.25);
  const reveals = root.querySelectorAll('[data-reveal]');
  if (reveals.length) {
    tl.fromTo(reveals, { y: 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out', stagger: 0.09 }, 0.35);
  }
  return tl;
}

/** A 96×96 tile of grey noise as a data URL, for the TV's channel-change static. */
let noiseUrl = null;
export function noiseTile() {
  if (noiseUrl) return noiseUrl;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noiseUrl = c.toDataURL();
  return noiseUrl;
}
