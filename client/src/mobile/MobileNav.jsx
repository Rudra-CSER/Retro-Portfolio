import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap, prefersReduced, ScrollTrigger, scrollToTarget } from '../lib/motion';
import { sfx } from '../lib/audio';

/**
 * Phone-only category bar. Appears once you leave the title screen, tracks the
 * chapter you're in (the pill slides to it), jumps on tap, and shows overall
 * progress. The HUD slides away while you scroll down and returns on scroll up.
 */
export default function MobileNav({ chapters }) {
  const nav = useRef(null);
  const row = useRef(null);
  const pill = useRef(null);
  const bar = useRef(null);
  const ui = useRef({ shown: false, hdrHidden: false });
  const [active, setActive] = useState(-1);

  const apply = () => {
    const { shown, hdrHidden } = ui.current;
    const hud = document.querySelector('.hud');
    const hh = hud ? hud.offsetHeight : 64;
    const d = prefersReduced ? 0 : 0.42;
    gsap.to(nav.current, {
      y: shown ? (hdrHidden ? -hh : 0) : -14,
      autoAlpha: shown ? 1 : 0,
      duration: d,
      ease: 'power3.out',
      overwrite: 'auto',
    });
    if (hud) gsap.to(hud, { yPercent: hdrHidden ? -100 : 0, duration: d, ease: 'power3.out', overwrite: 'auto' });
    // chapters snap just under whatever chrome is showing
    const rootStyle = document.documentElement.style;
    if (shown && hdrHidden) rootStyle.setProperty('--m-hdr', '0px');
    else rootStyle.removeProperty('--m-hdr');
  };

  useLayoutEffect(() => {
    gsap.set(nav.current, { autoAlpha: 0, y: -14 });
    const show = ScrollTrigger.create({
      trigger: '#top',
      start: 'bottom 72%',
      onEnter: () => {
        ui.current.shown = true;
        apply();
      },
      onLeaveBack: () => {
        ui.current = { shown: false, hdrHidden: false };
        apply();
      },
    });
    const dir = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        if (!ui.current.shown || document.documentElement.classList.contains('is-locked')) return;
        const hide = self.direction === 1;
        if (hide !== ui.current.hdrHidden && Math.abs(self.getVelocity()) > 40) {
          ui.current.hdrHidden = hide;
          apply();
        }
      },
    });
    const prog = gsap.fromTo(bar.current, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.4 } });
    return () => {
      show.kill();
      dir.kill();
      prog.scrollTrigger?.kill();
      prog.kill();
      const hud = document.querySelector('.hud');
      if (hud) gsap.set(hud, { clearProps: 'transform' });
      document.documentElement.style.removeProperty('--m-hdr');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // which chapter is under the bar
  useEffect(() => {
    let raf = 0;
    const run = () => {
      raf = 0;
      const line = window.innerHeight * 0.42;
      let idx = -1;
      chapters.forEach((c, i) => {
        const el = document.getElementById(c.id);
        if (el && el.getBoundingClientRect().top <= line) idx = i;
      });
      setActive(idx);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    run();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, [chapters]);

  // slide the pill + keep the active chip in view
  useLayoutEffect(() => {
    const r = row.current;
    const chip = r?.querySelectorAll('button')[active];
    if (!chip) {
      gsap.to(pill.current, { autoAlpha: 0, duration: 0.2 });
      return;
    }
    gsap.to(pill.current, {
      x: chip.offsetLeft,
      width: chip.offsetWidth,
      autoAlpha: 1,
      duration: prefersReduced ? 0 : 0.65,
      ease: 'elastic.out(1, 0.8)',
    });
    const left = Math.max(0, chip.offsetLeft - (r.clientWidth - chip.offsetWidth) / 2);
    r.scrollTo({ left, behavior: prefersReduced ? 'auto' : 'smooth' });
  }, [active]);

  return (
    <nav ref={nav} className="m-nav" aria-label="Sections">
      <div className="m-nav-row" ref={row}>
        <span className="m-nav-pill" ref={pill} aria-hidden="true" />
        {chapters.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={i === active ? 'is-active' : ''}
            aria-current={i === active ? 'true' : undefined}
            onClick={() => {
              sfx.select();
              const el = document.getElementById(c.id);
              if (!el) return;
              // going down tucks the HUD away, going up brings it back: settle that first
              // so the jump lands exactly under the bar
              ui.current.hdrHidden = el.getBoundingClientRect().top > 0;
              apply();
              scrollToTarget(el);
            }}
          >
            <small>{String(i + 1).padStart(2, '0')}</small>
            {c.label}
          </button>
        ))}
      </div>
      <i className="m-nav-progress" aria-hidden="true">
        <b ref={bar} />
      </i>
    </nav>
  );
}
