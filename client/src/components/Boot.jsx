import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from '../lib/motion';
import { sfx } from '../lib/audio';
import { useGame } from '../lib/state';
import { music } from '../lib/music';
import { createIntro } from '../intro/engine';
import { introSound } from '../intro/sound';

/**
 * Opening: a 1999 bedroom rendered like a PS1 game.
 *  standby · PRESS START glows on the pad
 *  power   · the console clicks on, the disc spins up, the CRT warms up and lights the room
 *  boot    · the RNM-16 logo plays on the TV with an original swell
 *  title   · the game's title screen; START is accepted and the camera dives into the glass
 *  open    · the site switches on like a CRT, opening out from a bright line
 * The tap on PRESS START is also what lets the browser play sound. Repeat visits in the
 * same tab get a short version; SKIP is always there.
 */
export default function Boot({ logo = 'RUDRA', host, onReveal, onExit }) {
  const root = useRef(null);
  const canvas = useRef(null);
  const hit = useRef(null);
  const api = useRef(null);
  const tl = useRef(null);
  const startedAt = useRef(0);
  const opened = useRef(false);
  const [phase, setPhase] = useState('gate'); // gate → run → open
  const { sound } = useGame();
  const quick = useMemo(() => {
    try {
      return sessionStorage.getItem('rudra.booted') === '1';
    } catch {
      return false;
    }
  }, []);
  const compact = useMemo(() => window.matchMedia('(max-width: 720px)').matches, []);

  // the site switches on: a bright line, then the picture opens top and bottom
  const open = () => {
    if (opened.current) return;
    opened.current = true;
    tl.current?.kill();
    try {
      sessionStorage.setItem('rudra.booted', '1');
    } catch {
      /* ignore */
    }
    const el = root.current;
    const q = gsap.utils.selector(el);
    setPhase('open');
    api.current?.stop();
    onReveal?.();
    music.release('intro');
    introSound.open();
    gsap
      .timeline({ onComplete: () => onExit?.() })
      .to(canvas.current, { autoAlpha: 0, duration: 0.1, ease: 'none' }, 0)
      .set(el, { backgroundColor: 'transparent' }, 0.1)
      .fromTo(q('.bo-line'), { scaleX: 0, autoAlpha: 1 }, { scaleX: 1, duration: 0.14, ease: 'power2.out' }, 0.04)
      .to(q('.bo-top'), { yPercent: -100, duration: 0.62, ease: 'power3.inOut' }, 0.2)
      .to(q('.bo-bot'), { yPercent: 100, duration: 0.62, ease: 'power3.inOut' }, 0.2)
      .to(q('.bo-line'), { scaleY: 36, autoAlpha: 0, duration: 0.42, ease: 'power2.out' }, 0.2);
  };

  const skip = () => {
    if (opened.current) return;
    tl.current?.kill();
    introSound.stop();
    gsap.to(canvas.current, { autoAlpha: 0, duration: 0.18, ease: 'none', onComplete: open });
  };

  const run = () => {
    const intro = api.current;
    if (!intro || startedAt.current) return;
    startedAt.current = performance.now();
    setPhase('run');
    const S = intro.state;
    const t = gsap.timeline({ onComplete: open });
    tl.current = t;

    if (quick) {
      // been here this session: straight to the title screen and in
      Object.assign(S, { startGlow: 0, power: 1, tvLed: 1, slider: 1, mode: 'title', t: 1.3, shot: 1.55 });
      t.to(S, { shot: 2, duration: 0.4, ease: 'power2.out' })
        .call(() => sfx.start())
        .set(S, { confirm: true })
        .to(S, { t: 2.3, duration: 1, ease: 'none' }, '<')
        .call(() => introSound.whoosh(0.85), null, '<0.15')
        .to(S, { shot: 3, sway: 0, duration: 0.85, ease: 'power3.in' }, '<')
        .call(open, null, '-=0.06');
      return;
    }

    t.call(introSound.press, null, 0)
      .to(S, { press: 1, duration: 0.05, ease: 'none' }, 0)
      .to(S, { press: 0, duration: 0.08, ease: 'none' }, 0.14)
      .to(S, { startGlow: 0, duration: 0.3 }, 0.05)
      // the console switches on
      .call(introSound.power, null, 0.16)
      .to(S, { slider: 1, duration: 0.1, ease: 'steps(3)' }, 0.16)
      .set(S, { power: 1 }, 0.2)
      .call(introSound.spin, null, 0.3)
      .to(S, { shot: 1, duration: 1.8, ease: 'power2.inOut' }, 0.35)
      // the CRT warms up
      .call(introSound.crtOn, null, 0.8)
      .set(S, { mode: 'power', t: 0, tvLed: 1 }, 0.8)
      .to(S, { t: 1, duration: 0.62, ease: 'none' }, 0.8)
      // boot logo
      .call(introSound.chime, null, 1.42)
      .set(S, { mode: 'emblem', t: 0 }, 1.42)
      .to(S, { t: 2.2, duration: 2.2, ease: 'none' }, 1.42)
      .to(S, { shot: 2, duration: 1.7, ease: 'power1.inOut' }, 2.2)
      // title screen, START accepted, dive into the glass
      .set(S, { mode: 'title', t: 0 }, 3.62)
      .to(S, { t: 2.1, duration: 2.1, ease: 'none' }, 3.62)
      .call(() => sfx.start(), null, 4.55)
      .set(S, { confirm: true }, 4.55)
      .call(() => introSound.whoosh(1), null, 4.65)
      .to(S, { shot: 3, sway: 0, duration: 1, ease: 'power3.in' }, 4.65)
      .call(open, null, 5.58);
  };

  useLayoutEffect(() => {
    music.hold('intro');
    let idle = 0;
    try {
      api.current = createIntro(canvas.current, { compact, logo });
      api.current.start();
      if (quick) run();
      else idle = setTimeout(run, 9000); // nobody pressed anything: start on its own (silently)
      hit.current?.focus({ preventScroll: true });
    } catch {
      open(); // no canvas: just show the site
    }
    return () => {
      clearTimeout(idle);
      tl.current?.kill();
      api.current?.dispose();
      music.release('intro');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.current?.setHost(host?.label || '');
  }, [host]);

  // START: a tap, a click or any key. Once it's running, the same again skips.
  useEffect(() => {
    const onKey = (e) => {
      if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'].includes(e.key) || opened.current) return;
      if (e.key === 'Escape') return skip();
      if (!startedAt.current) run();
      else if (performance.now() - startedAt.current > 800) skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const press = () => {
    if (!startedAt.current) run();
    else if (performance.now() - startedAt.current > 800) skip();
  };

  return (
    <div ref={root} className={`boot is-${phase}`} role="dialog" aria-label="RUDRA.ROM is starting">
      <i className="bo-top" aria-hidden="true" />
      <i className="bo-bot" aria-hidden="true" />
      <canvas ref={canvas} className="boot-canvas" aria-hidden="true" />
      <button ref={hit} type="button" className="boot-hit" data-cursor="free" onClick={press} aria-label={phase === 'gate' ? 'Press start' : 'Skip the intro'} />
      <div className="boot-gate" aria-hidden="true">
        <p className="boot-start">PRESS START</p>
        <p className="boot-hint">
          {compact ? 'TAP TO POWER ON' : 'CLICK OR PRESS ANY KEY'} · {sound ? 'SOUND ON' : 'SOUND OFF'}
        </p>
      </div>
      <b className="bo-line" aria-hidden="true" />
      <button type="button" className="boot-skip" onClick={skip}>
        SKIP INTRO ▸▸
      </button>
    </div>
  );
}
