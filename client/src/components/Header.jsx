import { forwardRef, useRef } from 'react';
import PixelText from './PixelText';
import PixelRing from './PixelRing';
import { PALETTE_NAMES, PALETTE_SWATCHES, PALETTES, useGame } from '../lib/state';
import { pad, useMagnetic } from '../lib/hooks';
import { scrollToTarget } from '../lib/motion';
import { sfx } from '../lib/audio';

const STAGES = {
  '1-1': 'TITLE',
  '1-2': 'BIO',
  '1-3': 'PLAYER',
  '1-4': 'MANUAL',
  '2-1': 'SELECT',
  '2-2': 'QUESTS',
  '2-3': 'FAME',
  '3-1': 'BONUS',
  '3-2': 'EXTRA',
  '4-1': 'CONTINUE',
};

/** Pixel speaker: sound waves when on, a cross when muted. */
function Speaker({ on }) {
  return (
    <svg className="spk" viewBox="0 0 14 12" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M0 4h3v4H0zM3 3h1v6H3zM4 2h1v8H4zM5 1h1v10H5zM6 0h1v12H6z" fill="currentColor" />
      {on ? (
        <path d="M8 4h1v4H8zM10 2h1v1h-1zM11 3h1v6h-1zM10 9h1v1h-1z" fill="currentColor" />
      ) : (
        <path d="M8 3h1v1H8zM9 4h1v1H9zM10 5h1v2h-1zM9 7h1v1H9zM8 8h1v1H8zM12 3h1v1h-1zM11 4h1v1h-1zM11 7h1v1h-1zM12 8h1v1h-1z" fill="currentColor" />
      )}
    </svg>
  );
}

const Header = forwardRef(function Header({ logo, booted }, logoRef) {
  const g = useGame();
  const menuBtn = useRef(null);
  const sndBtn = useRef(null);
  useMagnetic(menuBtn, { strength: 0.38 });
  useMagnetic(sndBtn, { strength: 0.25, radius: 50 });

  return (
    <header className={`hud ${booted ? 'is-booted' : ''}`}>
      <a
        href="#top"
        className="hud-logo"
        aria-label={`${logo} — back to top`}
        onClick={(e) => {
          e.preventDefault();
          scrollToTarget('#top');
        }}
      >
        <PixelText ref={logoRef} lines={[logo]} decorative className="hud-logo-px" />
        <span className="hud-caret" aria-hidden="true" />
      </a>

      <div className="hud-center" aria-hidden="true">
        <span>
          1UP <b className="hud-score">{pad(g.score)}</b>
        </span>
        <span>
          HI <b>{pad(g.hi)}</b>
        </span>
        <span className="hud-stage">
          STAGE <b>{g.stage}</b> <em>{STAGES[g.stage] || ''}</em>
        </span>
      </div>

      <div className="hud-right">
        {/* one tap changes the whole site's colours (the same five as PALETTE in the pause menu) */}
        <div className="hud-pal" role="group" aria-label="Colour palette">
          {PALETTES.map((p) => (
            <button
              key={p}
              type="button"
              className={p === g.palette ? 'is-on' : ''}
              aria-pressed={p === g.palette}
              aria-label={`${PALETTE_NAMES[p]} palette`}
              title={PALETTE_NAMES[p]}
              onClick={() => {
                if (p === g.palette) return;
                g.setPalette(p);
                g.unlock('palette');
                sfx.select();
              }}
            >
              <i style={{ '--sw': PALETTE_SWATCHES[p] }} />
            </button>
          ))}
        </div>
        {g.sound && g.music && g.track?.playing ? (
          <button type="button" className="hud-track" onClick={() => g.nextTrack()} aria-label={`Now playing ${g.track.title}. Next track`}>
            <span className="snd-bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="hud-track-no">{String(g.track.number).padStart(2, '0')}</span>
            <span className="hud-track-name">{g.track.title}</span>
            <span className="hud-track-skip" aria-hidden="true">
              ▸▸
            </span>
          </button>
        ) : null}
        <button
          ref={sndBtn}
          type="button"
          className={`hud-snd ${g.sound ? 'is-on' : ''}`}
          aria-pressed={g.sound}
          aria-label={g.sound ? 'Sound on. Mute' : 'Sound off. Unmute'}
          onClick={() => {
            const next = !g.sound;
            g.setSound(next);
            if (next) setTimeout(() => sfx.select(), 30);
          }}
        >
          <Speaker on={g.sound} />
          <span className="hud-snd-label">{g.sound ? 'SOUND' : 'MUTED'}</span>
        </button>
        <button
          ref={menuBtn}
          type="button"
          className={`hud-menu ${g.menuOpen ? 'is-open' : ''}`}
          aria-label={g.menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={g.menuOpen}
          aria-controls="pause-menu"
          onClick={() => {
            sfx.select();
            g.setMenuOpen(!g.menuOpen);
          }}
        >
          <PixelRing />
          <span className="hud-menu-lines" aria-hidden="true">
            <i />
            <i />
          </span>
        </button>
      </div>
    </header>
  );
});

export default Header;
