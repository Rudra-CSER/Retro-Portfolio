import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { gsap, lockScroll, prefersReduced, unlockScroll } from '../lib/motion';
import { sfx } from '../lib/audio';
import Sprite from './Sprite';

/**
 * In-game "item description" window with the long-form details of a quest.
 * Rendered into <body> so no section's overflow, transform or stacking can
 * reach it. The title bar sits outside the scrolling area, so content can
 * never slide over it and its close button always works.
 */
export default function CaseFile({ project, onClose }) {
  const root = useRef(null);
  const closeBtn = useRef(null);

  useEffect(() => {
    if (!project) return undefined;
    lockScroll('casefile');
    const prev = document.activeElement;
    const el = root.current;
    if (!prefersReduced) {
      gsap.fromTo(el.querySelector('.cf-window'), { clipPath: 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0% 0 0% 0)', duration: 0.45, ease: 'steps(8)' });
      gsap.fromTo(el.querySelectorAll('.cf-row'), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, stagger: 0.05, duration: 0.4, delay: 0.25, clearProps: 'transform' });
    }
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab') {
        const f = [...el.querySelectorAll('a, button')];
        if (!f.length) return;
        const first = f[0];
        const last = f.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      unlockScroll('casefile');
      prev?.focus?.({ preventScroll: true });
    };
  }, [project, onClose]);

  if (!project) return null;
  const p = project;
  const close = () => {
    sfx.back();
    onClose();
  };

  return createPortal(
    <div className="casefile" ref={root} role="dialog" aria-modal="true" aria-labelledby="cf-title" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cf-window">
        <div className="cf-bar">
          <span className="cf-bar-title">CASE FILE · {p.name}</span>
          <button ref={closeBtn} type="button" className="cf-close" onClick={close} aria-label="Close case file">
            ✕ <span>CLOSE</span>
          </button>
        </div>
        <div className="cf-scroll">
          <div className="cf-body">
            <div className="cf-art cf-row" aria-hidden="true">
              <Sprite name={p.sprite} />
            </div>
            <div className="cf-main">
              <p className="cf-cat cf-row">{p.category}</p>
              <h3 id="cf-title" className="cf-title serif-i cf-row">
                {p.title}
              </h3>
              <p className="cf-desc cf-row">{p.description}</p>
              {p.stat && (
                <p className="cf-stat cf-row">
                  <span>★</span> {p.stat}
                </p>
              )}
              {p.highlights?.length > 0 && (
                <ul className="cf-list cf-row">
                  {p.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
              <p className="cf-tags cf-row">
                {p.tags.map((t) => (
                  <span key={t} className="pill">
                    {t}
                  </span>
                ))}
              </p>
              <div className="cf-links cf-row">
                {p.liveUrl && (
                  <a href={p.liveUrl} target="_blank" rel="noopener noreferrer">
                    LIVE SITE ↗
                  </a>
                )}
                {p.sourceUrl && (
                  <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
                    SOURCE CODE ↗
                  </a>
                )}
                {!p.liveUrl && !p.sourceUrl && <span className="cf-private">DEMO ON REQUEST · INSERT COIN BELOW ↓</span>}
              </div>
            </div>
          </div>
          <button type="button" className="cf-done" onClick={close}>
            ✕ CLOSE CASE FILE
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
