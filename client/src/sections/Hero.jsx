import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import PixelText from '../components/PixelText';
import Sprite from '../components/Sprite';
import { gsap, prefersReduced, scrollToTarget } from '../lib/motion';
import { useStage } from '../lib/useStage';
import { pixelAssemble } from '../mobile/fx';

function Cycle({ words, active }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active || prefersReduced) return;
    const id = setInterval(() => setI((n) => (n + 1) % words.length), 2000);
    return () => clearInterval(id);
  }, [active, words.length]);
  return (
    <span className="cycle-window" aria-live="off">
      <span className="cycle-track" style={{ '--i': i }}>
        {words.map((w) => (
          <span key={w} className="cycle-word">
            {w}
          </span>
        ))}
      </span>
    </span>
  );
}

export default function Hero({ content, revealed, mobile = false }) {
  const root = useRef(null);
  const sceneBox = useRef(null);
  const scene = useRef(null);
  const [noGL, setNoGL] = useState(false);
  const h = content.hero;
  useStage(root, '1-1');

  useEffect(() => {
    let disposed = false;
    import('../three/heroScene')
      .then(({ createHeroScene }) => {
        if (disposed || !sceneBox.current) return;
        try {
          scene.current = createHeroScene(sceneBox.current, { pixel: window.innerWidth < 720 ? 3 : 3 });
        } catch {
          setNoGL(true);
        }
      })
      .catch(() => setNoGL(true));
    return () => {
      disposed = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useGSAP(
    () => {
      if (!revealed) return;
      const el = root.current;
      const px = el.querySelector('.hero-px');
      if (mobile && !prefersReduced) {
        px.classList.add('is-static');
        pixelAssemble(px.querySelector('svg'), { spread: 22, duration: 1.1, amount: 0.75 });
      } else px?.classList.add('is-in');
      if (prefersReduced) return;
      gsap.fromTo(el.querySelectorAll('.hero-italic .mask-inner'), { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'power4.out', delay: 0.55 });
      gsap.fromTo(el.querySelectorAll('.hero-fade'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, delay: 0.9, ease: 'power3.out' });
      gsap.fromTo(sceneBox.current, { autoAlpha: 0, scale: 1.04 }, { autoAlpha: 1, scale: 1, duration: 1.6, ease: 'power2.out' });
      // scroll: headline drifts up slower than the page, sculpture shrinks
      gsap.to(el.querySelector('.hero-copy'), {
        yPercent: -28,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true },
      });
      gsap.to(
        {},
        {
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
            onUpdate: (self) => scene.current?.setProgress(self.progress),
          },
        },
      );
    },
    { scope: root, dependencies: [revealed] }, // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <section id="top" ref={root} className="hero" aria-label="Introduction">
      <div className={`hero-scene ${noGL ? 'is-fallback' : ''}`} ref={sceneBox} aria-hidden="true">
        {noGL && <Sprite name="molecule" className="hero-fallback" />}
      </div>
      <div className="hero-copy">
        <h1 className="hero-title">
          <span className="sr-only">
            {h.lines.join(' ')} {h.italic}
          </span>
          <PixelText
            lines={h.lines}
            mobileLines={h.linesMobile}
            decorative
            reveal="power"
            spread={900}
            className={`hero-px ${prefersReduced ? 'is-in' : ''}`}
          />
          <span className="hero-italic serif-i" aria-hidden="true">
            <span className="mask">
              <span className="mask-inner">{h.italic}</span>
            </span>
          </span>
        </h1>
      </div>

      <div className="hero-cycle hero-fade">
        <span className="hero-cycle-label">{h.cycleLabel}</span>
        <Cycle words={h.cycle} active={revealed} />
      </div>
      <div className="hero-corner hero-corner-l hero-fade" aria-hidden="true">
        <span>{content.person.coords}</span>
        <span>{content.person.org.toUpperCase()}</span>
      </div>
      <button type="button" className="hero-corner hero-corner-r hero-fade" onClick={() => scrollToTarget('#bio')}>
        SCROLL <span className="hero-arrow">▼</span>
      </button>
    </section>
  );
}
