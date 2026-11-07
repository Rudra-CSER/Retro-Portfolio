import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import MChapter from './MChapter';
import PixelText from '../components/PixelText';
import Marquee from '../components/Marquee';
import { gsap, prefersReduced, ScrollTrigger } from '../lib/motion';
import { sfx } from '../lib/audio';
import { noiseTile, pixelAssemble } from './fx';

const DWELL = 4.6; // seconds per channel while on autoplay
const pad2 = (n) => String(n).padStart(2, '0');

/** Abilities as TV channels: swipe, tap ◀ ▶, or let it surf on its own. */
export default function MSkills({ content, chapter, index, total }) {
  const abilities = content.abilities;
  const n = abilities.length;
  const [ch, setCh] = useState(0);
  const [auto, setAuto] = useState(!prefersReduced);
  const screen = useRef(null);
  const canvasBox = useRef(null);
  const staticEl = useRef(null);
  const contentEl = useRef(null);
  const timer = useRef(null);
  const timerTween = useRef(null);
  const visible = useRef(false);
  const entered = useRef(false);
  const swipe = useRef(null);

  // the heme molecule from the desktop TV, dimmed behind the channel text
  useEffect(() => {
    let s = null;
    let dead = false;
    staticEl.current.style.backgroundImage = `url(${noiseTile()})`;
    import('../three/crtScene')
      .then(({ createCrtScene }) => {
        if (dead || !canvasBox.current) return;
        try {
          s = createCrtScene(canvasBox.current);
        } catch {
          /* no WebGL: the screen stays dark */
        }
      })
      .catch(() => {});
    return () => {
      dead = true;
      s?.dispose();
    };
  }, []);

  const tune = useCallback(() => {
    if (prefersReduced || !contentEl.current) return;
    const c = contentEl.current;
    gsap
      .timeline()
      .fromTo(staticEl.current, { autoAlpha: 0.95 }, { autoAlpha: 0, duration: 0.45, ease: 'steps(5)' }, 0)
      .fromTo(screen.current, { filter: 'brightness(1.8)' }, { filter: 'brightness(1)', duration: 0.35, ease: 'power2.out' }, 0)
      .add(pixelAssemble(c.querySelector('.mtv-title svg'), { spread: 10, duration: 0.65, amount: 0.3 }), 0.06)
      .fromTo(c.querySelectorAll('.mtv-line .mask-inner'), { yPercent: 110 }, { yPercent: 0, duration: 0.75, ease: 'power4.out' }, 0.18)
      .fromTo(c.querySelector('.mtv-detail'), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.32);
  }, []);

  // first tune-in when the TV scrolls into view
  useLayoutEffect(() => {
    if (prefersReduced) return;
    gsap.set(contentEl.current.querySelectorAll('.mtv-title rect'), { opacity: 0 });
    const st = ScrollTrigger.create({
      trigger: screen.current,
      start: 'top 78%',
      once: true,
      onEnter: () => {
        entered.current = true;
        tune();
      },
    });
    return () => st.kill();
  }, [tune]);

  // every channel change re-tunes
  const firstRender = useRef(true);
  useLayoutEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (entered.current) tune();
  }, [ch, tune]);

  const go = useCallback(
    (d, manual) => {
      if (manual) {
        setAuto(false);
        sfx.select();
      } else sfx.blip();
      setCh((c) => (c + d + n) % n);
    },
    [n],
  );

  // autoplay progress bar → next channel
  useEffect(() => {
    timerTween.current?.kill();
    gsap.set(timer.current, { scaleX: 0 });
    if (!auto) return undefined;
    timerTween.current = gsap.to(timer.current, {
      scaleX: 1,
      duration: DWELL,
      ease: 'none',
      paused: !visible.current,
      onComplete: () => go(1, false),
    });
    return () => timerTween.current?.kill();
  }, [ch, auto, go]);

  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => {
        visible.current = e.isIntersecting;
        if (e.isIntersecting) timerTween.current?.play();
        else timerTween.current?.pause();
      },
      { threshold: 0.6 },
    );
    io.observe(screen.current);
    return () => io.disconnect();
  }, []);

  const onDown = (e) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? 1 : -1, true);
  };

  const ab = abilities[ch];
  return (
    <MChapter id={chapter.id} index={index} total={total} title={chapter.title} kicker={chapter.kicker} stage="1-3" className="mch-skills">
      <div className="mtv" data-reveal>
        <div
          className="mtv-screen"
          ref={screen}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={() => (swipe.current = null)}
          role="group"
          aria-roledescription="carousel"
          aria-label="Abilities"
        >
          <div className="mtv-canvas" ref={canvasBox} aria-hidden="true" />
          <div className="mtv-osd" aria-hidden="true">
            <span>
              CH {pad2(ch + 1)} <em>/ {pad2(n)}</em>
            </span>
            <span>
              <i className="rec" /> {auto ? 'AUTO' : 'HOLD'}
            </span>
          </div>
          <div className="mtv-content" ref={contentEl} aria-live="polite">
            <PixelText key={ab.left} lines={[ab.left]} label={ab.left} className="mtv-title" maxPx={4.2} />
            <p className="mtv-line serif-i">
              <span className="mask">
                <span className="mask-inner">{ab.right}</span>
              </span>
            </p>
            <p className="mtv-detail">{ab.detail}</p>
          </div>
          <div className="mtv-static" ref={staticEl} aria-hidden="true" />
          <div className="mtv-glass" aria-hidden="true" />
        </div>
        <div className="mtv-controls">
          <button type="button" onClick={() => go(-1, true)} aria-label="Previous ability">
            ◀
          </button>
          <div className="mtv-dots">
            {abilities.map((a, i) => (
              <button
                key={a.left}
                type="button"
                className={i === ch ? 'is-on' : ''}
                aria-label={a.left}
                aria-current={i === ch ? 'true' : undefined}
                onClick={() => {
                  setAuto(false);
                  sfx.select();
                  setCh(i);
                }}
              />
            ))}
          </div>
          <button type="button" onClick={() => go(1, true)} aria-label="Next ability">
            ▶
          </button>
        </div>
        <i className="mtv-timer" aria-hidden="true">
          <b ref={timer} />
        </i>
      </div>

      <div className="m-inventory" data-reveal>
        <p className="label">
          <b>[</b> INVENTORY <b>]</b>
        </p>
        <Marquee speed={38} label="Tools">
          {content.tools.map((t) => (
            <span key={t} className="inv-item">
              <i className="inv-slot" aria-hidden="true" />
              {t}
            </span>
          ))}
        </Marquee>
      </div>
    </MChapter>
  );
}
