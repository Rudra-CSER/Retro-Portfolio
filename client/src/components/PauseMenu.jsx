import { useEffect, useRef } from 'react';
import { gsap, lockScroll, prefersReduced, scrollToTarget, unlockScroll } from '../lib/motion';
import { useGame, PALETTE_NAMES } from '../lib/state';
import { sfx } from '../lib/audio';

const ITEMS = [
  { label: 'CONTINUE', target: null },
  { label: 'HOME', target: '#top' },
  { label: 'BIO', target: '#bio' },
  { label: 'ABILITIES', target: '#player' },
  { label: 'QUESTS', target: '#stage-select' },
  { label: 'BONUS STAGE', target: '#arcade' },
  { label: 'CONTACT', target: '#continue' },
];
const ITEMS_MOBILE = [
  { label: 'CONTINUE', target: null },
  { label: 'HOME', target: '#top' },
  { label: 'BIO', target: '#m-bio' },
  { label: 'ABILITIES', target: '#m-skills' },
  { label: 'QUESTS', target: '#m-quests' },
  { label: 'HALL OF FAME', target: '#m-fame' },
  { label: 'BONUS STAGE', target: '#arcade' },
  { label: 'CONTACT', target: '#continue' },
];

export default function PauseMenu({ mobile = false }) {
  const items = mobile ? ITEMS_MOBILE : ITEMS;
  const g = useGame();
  const root = useRef(null);
  const tl = useRef(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const el = root.current;
    if (g.menuOpen) {
      wasOpen.current = true;
      lockScroll('menu');
      el.hidden = false;
      tl.current?.kill();
      tl.current = gsap
        .timeline()
        .fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: prefersReduced ? 0 : 0.5, ease: 'steps(8)' })
        .fromTo(
          el.querySelectorAll('.pm-item .mask-inner'),
          { yPercent: 110 },
          { yPercent: 0, duration: prefersReduced ? 0 : 0.7, ease: 'power4.out', stagger: 0.05 },
          0.15,
        )
        .fromTo(el.querySelectorAll('.pm-fade'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, stagger: 0.05 }, 0.3);
      requestAnimationFrame(() => el.querySelector('.pm-item button')?.focus({ preventScroll: true }));
    } else if (wasOpen.current) {
      tl.current?.kill();
      tl.current = gsap
        .timeline({ onComplete: () => (el.hidden = true) })
        .to(el, { clipPath: 'inset(100% 0 0% 0)', duration: prefersReduced ? 0 : 0.4, ease: 'steps(6)' });
      unlockScroll('menu');
    }
  }, [g.menuOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && g.menuOpen) {
        e.preventDefault();
        sfx.back();
        g.setMenuOpen(false);
        return;
      }
      if ((e.key === 'p' || e.key === 'P') && !g.menuOpen && !e.target.closest?.('input, textarea')) {
        if (document.querySelector('.arcade.is-playing, .arcade.is-paused')) return; // the game owns P during a match
        sfx.select();
        g.setMenuOpen(true);
        return;
      }
      if (!g.menuOpen || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      const btns = [...root.current.querySelectorAll('button')];
      const i = btns.indexOf(document.activeElement);
      const next = btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length];
      next?.focus();
      sfx.blip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [g]);

  const go = (target) => {
    sfx.select();
    g.setMenuOpen(false);
    if (target) setTimeout(() => scrollToTarget(target, { duration: 2 }), prefersReduced ? 0 : 380);
  };

  return (
    <div id="pause-menu" ref={root} className="pause" role="dialog" aria-modal="true" aria-label="Pause menu" hidden>
      <div className="pause-head pm-fade">
        <span className="label">
          <b>[</b> PAUSED <b>]</b>
        </span>
        <span className="pause-hint">↑ ↓ SELECT · ENTER CONFIRM · ESC RESUME</span>
      </div>
      <ul className="pause-list">
        {items.map((it) => (
          <li key={it.label} className="pm-item">
            <span className="mask">
              <span className="mask-inner">
                <button type="button" onClick={() => go(it.target)}>
                  <span className="pm-arrow" aria-hidden="true">
                    ▶
                  </span>
                  {it.label}
                </button>
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className="pause-options pm-fade" role="group" aria-label="Options">
        <button type="button" onClick={() => { g.setSound(!g.sound); sfx.select(); }}>
          SOUND <b>{g.sound ? 'ON' : 'OFF'}</b>
        </button>
        <button type="button" onClick={() => { g.setMusic(!g.music); sfx.select(); }}>
          MUSIC <b>{g.music ? 'ON' : 'OFF'}</b>
        </button>
        {g.sound && g.music && g.track ? (
          <button type="button" className="pm-track" onClick={() => g.nextTrack()}>
            TRACK <b>{String(g.track.number).padStart(2, '0')} {g.track.title}</b> ▸▸
          </button>
        ) : null}
        <button type="button" onClick={() => { g.setCrt(!g.crt); sfx.select(); }}>
          CRT FX <b>{g.crt ? 'ON' : 'OFF'}</b>
        </button>
        <button
          type="button"
          onClick={() => {
            g.cyclePalette();
            g.unlock('palette');
            sfx.select();
          }}
        >
          PALETTE <b>{PALETTE_NAMES[g.palette]}</b>
        </button>
      </div>
      <p className="pause-foot pm-fade">TIP — TRY ↑ ↑ ↓ ↓ ← → ← → B A ANYWHERE</p>
    </div>
  );
}
