import { useCallback, useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import PixelText from '../components/PixelText';
import { createPixelCup, MATCH_SECONDS } from '../game/pixelCup';
import { fetchScores, scorePoints, submitScore } from '../lib/api';
import { crowdStart, crowdStop, sfx } from '../lib/audio';
import { music } from '../lib/music';
import { useMedia } from '../lib/hooks';
import { gsap, lockScroll, prefersReduced, scrollToTarget, unlockScroll } from '../lib/motion';
import { chapterIntro } from '../mobile/fx';
import { useStage } from '../lib/useStage';
import { useActions } from '../lib/state';

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'shoot', KeyX: 'shoot', KeyJ: 'shoot',
  KeyZ: 'pass', KeyK: 'pass', KeyC: 'pass',
};

function Stick({ engine }) {
  const pad = useRef(null);
  const knob = useRef(null);
  const id = useRef(null);
  const set = (x, y) => {
    engine.current?.setStick(x, y);
    if (knob.current) knob.current.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
  };
  const move = (e) => {
    if (e.pointerId !== id.current) return;
    const r = pad.current.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2.6);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2.6);
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    set(x, y);
  };
  return (
    <div
      ref={pad}
      className="pad-stick"
      onPointerDown={(e) => {
        id.current = e.pointerId;
        try {
          pad.current.setPointerCapture(e.pointerId);
        } catch {
          /* pointer already gone */
        }
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={() => {
        id.current = null;
        set(0, 0);
      }}
      onPointerCancel={() => {
        id.current = null;
        set(0, 0);
      }}
      aria-hidden="true"
    >
      <span className="pad-knob" ref={knob} />
    </div>
  );
}

function PadButton({ label, sub, btn, engine }) {
  const down = (e) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    e.currentTarget.classList.add('is-down');
    if (btn === 'pass') engine.current?.press('pass');
    else engine.current?.press('shoot');
  };
  const up = (e) => {
    e.currentTarget.classList.remove('is-down');
    if (btn === 'shoot') engine.current?.release('shoot');
  };
  return (
    <button type="button" className={`pad-btn pad-${btn}`} onPointerDown={down} onPointerUp={up} onPointerCancel={up} aria-label={sub}>
      <b>{label}</b>
      <small>{sub}</small>
    </button>
  );
}

const pad2 = (n) => String(n).padStart(2, '0');

export default function Arcade({ content, chapterNo = null }) {
  const root = useRef(null);
  const cab = useRef(null);
  const canvas = useRef(null);
  const engine = useRef(null);
  const modeRef = useRef('title');
  const [mode, setModeState] = useState('title'); // title | playing | paused | fulltime
  const [result, setResult] = useState(null);
  const [board, setBoard] = useState({ scores: [], local: false, loaded: false });
  const [initials, setInitials] = useState('');
  const [submit, setSubmit] = useState({ state: 'idle', rank: null, error: '' });
  const coarse = useMedia('(pointer: coarse)');
  const { unlock } = useActions();
  const g = content.game;
  useStage(root, '3-1');

  // phones: chapter entrance + the cabinet screen powers on like an old CRT
  useGSAP(
    () => {
      if (!chapterNo || prefersReduced) return;
      chapterIntro(root.current, { title: '.arcade-title svg' });
      const scr = root.current.querySelector('.cab-screen');
      gsap
        .timeline({ scrollTrigger: { trigger: scr, start: 'top 85%', once: true } })
        .fromTo(scr, { scaleY: 0.008, scaleX: 0.55, filter: 'brightness(3.2)' }, { scaleX: 1, duration: 0.22, ease: 'power2.out' })
        .to(scr, { scaleY: 1, duration: 0.42, ease: 'expo.out' })
        .to(scr, { filter: 'brightness(1)', duration: 0.5, ease: 'power1.out' }, '-=0.2')
        .from(root.current.querySelectorAll('.gamepad > *, .board'), { y: 24, autoAlpha: 0, stagger: 0.08, duration: 0.6, ease: 'power3.out' }, '-=0.3');
    },
    { scope: root },
  );

  const setMode = useCallback((m) => {
    modeRef.current = m;
    setModeState(m);
    root.current?.classList.toggle('is-playing', m === 'playing');
    root.current?.classList.toggle('is-paused', m === 'paused');
  }, []);

  useEffect(() => {
    fetchScores().then((r) => setBoard({ ...r, loaded: true }));
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const e = createPixelCup(canvas.current, {
      matchSeconds: Number(qs.get('match')) || MATCH_SECONDS,
      sfx,
      crowd: { start: crowdStart, stop: crowdStop },
      onEvent: (ev) => {
        if (ev.type === 'start') {
          music.hold('game');
          unlock('kickoff');
        }
        if (ev.type === 'goal' && !ev.demo && ev.team === 0) unlock('goal');
        if (ev.type === 'fulltime') {
          const [gf, ga] = ev.score;
          setResult({ gf, ga, points: scorePoints(gf, ga) });
          setSubmit({ state: 'idle', rank: null, error: '' });
          if (gf > ga) unlock('champion');
          setMode('fulltime');
          unlockScroll('game');
          music.release('game');
        }
      },
    });
    engine.current = e;
    const io = new IntersectionObserver(
      ([en]) => {
        if (en.isIntersecting) e.start();
        else {
          e.stop();
          if (modeRef.current === 'playing') {
            e.setPaused(true);
            setMode('paused');
            unlockScroll('game');
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(canvas.current);
    return () => {
      io.disconnect();
      e.dispose();
      unlockScroll('game');
      music.release('game');
    };
  }, [unlock, setMode]);

  const start = () => {
    sfx.start();
    const el = cab.current;
    let begun = false;
    const begin = () => {
      if (begun) return;
      begun = true;
      lockScroll('game');
      engine.current.startMatch();
      setMode('playing');
      root.current.querySelector('.cab-screen')?.focus({ preventScroll: true });
    };
    const r = el.getBoundingClientRect();
    const off = -Math.max(12, (window.innerHeight - r.height) / 2);
    scrollToTarget(el, { offset: off, duration: 0.8, onComplete: begin });
    // Fallback for no-smooth-scroll environments
    setTimeout(begin, 950);
  };
  const pause = () => {
    if (modeRef.current !== 'playing') return;
    engine.current.setPaused(true);
    setMode('paused');
    unlockScroll('game');
    sfx.back();
  };
  const resume = () => {
    lockScroll('game');
    engine.current.setPaused(false);
    setMode('playing');
    sfx.select();
  };
  const quit = () => {
    unlockScroll('game');
    music.release('game');
    engine.current.startDemo();
    setMode('title');
    sfx.back();
  };

  // keyboard
  useEffect(() => {
    const held = new Set();
    const stick = () => {
      const x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      const y = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
      engine.current?.setStick(x, y);
    };
    const down = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      const m = modeRef.current;
      if (m === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          pause();
          return;
        }
        const a = KEYMAP[e.code];
        if (!a) return;
        e.preventDefault();
        if (e.repeat) return;
        if (a === 'pass') engine.current.press('pass');
        else if (a === 'shoot') engine.current.press('shoot');
        else {
          held.add(a);
          stick();
        }
      } else if (m === 'paused' && (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Enter')) {
        if (!root.current.contains(document.activeElement) && e.code === 'Enter') return;
        e.preventDefault();
        resume();
      }
    };
    const up = (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (a === 'shoot') engine.current?.release('shoot');
      else if (a !== 'pass') {
        held.delete(a);
        stick();
      }
    };
    const blur = () => {
      held.clear();
      stick();
      engine.current?.release('shoot');
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    const ini = initials.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    if (ini.length !== 3) {
      setSubmit({ state: 'idle', rank: null, error: 'THREE LETTERS, PLAYER.' });
      sfx.error();
      return;
    }
    setSubmit({ state: 'sending', rank: null, error: '' });
    try {
      const r = await submitScore({ initials: ini, gf: result.gf, ga: result.ga });
      setBoard({ scores: r.scores, local: r.local, loaded: true });
      setSubmit({ state: 'done', rank: r.rank, error: '' });
      sfx.coin();
    } catch (err) {
      setSubmit({ state: 'idle', rank: null, error: (err.message || 'COULD NOT SAVE').toUpperCase() });
      sfx.error();
    }
  };

  return (
    <section id="arcade" ref={root} className="arcade section" aria-labelledby="arcade-title">
      <div className="arcade-head">
        {chapterNo ? (
          <p className="mch-no" aria-hidden="true">
            <b>
              {pad2(chapterNo.index)} / {pad2(chapterNo.total)}
            </b>
          </p>
        ) : null}
        <p className="label">
          <b>[</b> BONUS STAGE <b>]</b>
        </p>
        <h2 id="arcade-title" className="arcade-title">
          <PixelText lines={[g.title]} label={g.title} maxPx={14} />
          <span className="serif-i arcade-tag">{g.tagline}</span>
        </h2>
        <p className="arcade-sub">
          {g.home.name} vs {g.away.name}. A 4-a-side, {MATCH_SECONDS}-second match with a broadcast camera, a radar and a commentator who has
          seen too much. Scores go to the global leaderboard.
        </p>
      </div>

      <div className="arcade-grid">
        <div className="cabinet" ref={cab}>
          <div className="cab-screen" tabIndex={-1}>
            <canvas ref={canvas} className="game-canvas" aria-label={`${g.title} football match`} role="img" />

            {mode === 'title' && (
              <div className="cab-overlay is-title">
                <PixelText lines={[g.title]} decorative className="ov-title" />
                <p className="ov-vs">
                  <span className="kit kit-home" /> {g.home.name} <em>vs</em> {g.away.name} <span className="kit kit-away" />
                </p>
                <button type="button" className="ov-start" onClick={start}>
                  ▶ PRESS START
                </button>
                <p className="ov-small">{MATCH_SECONDS} SECONDS · BEAT THE DEADLINE</p>
              </div>
            )}

            {mode === 'paused' && (
              <div className="cab-overlay">
                <p className="ov-big">PAUSED</p>
                <div className="ov-row">
                  <button type="button" className="ov-start" onClick={resume}>
                    ▶ RESUME
                  </button>
                  <button type="button" className="ov-ghost" onClick={quit}>
                    QUIT
                  </button>
                </div>
              </div>
            )}

            {mode === 'fulltime' && result && (
              <div className="cab-overlay is-ft">
                <p className="ov-kicker">FULL TIME</p>
                <p className="ov-score">
                  {g.home.short} <b>{result.gf}</b> – <b>{result.ga}</b> {g.away.short}
                </p>
                <p className="ov-verdict">
                  {result.gf > result.ga ? 'CHAMPION!' : result.gf === result.ga ? 'HONOURS EVEN.' : 'THE DEADLINE WINS THIS TIME.'}{' '}
                  <span>{result.points} PTS</span>
                </p>
                {submit.state !== 'done' ? (
                  <form className="ov-form" onSubmit={onSubmit}>
                    <label htmlFor="ini">ENTER INITIALS</label>
                    <input
                      id="ini"
                      value={initials}
                      onChange={(e) => setInitials(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3))}
                      maxLength={3}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      placeholder="AAA"
                      inputMode="text"
                    />
                    <button type="submit" className="ov-start" disabled={submit.state === 'sending'}>
                      {submit.state === 'sending' ? 'SAVING…' : 'SUBMIT'}
                    </button>
                    {submit.error && <p className="ov-error">{submit.error}</p>}
                  </form>
                ) : (
                  <p className="ov-rank">
                    YOU PLACED <b>#{submit.rank}</b>
                    {board.local ? ' (THIS BROWSER)' : ' WORLDWIDE'}
                  </p>
                )}
                <div className="ov-row">
                  <button type="button" className="ov-ghost" onClick={start}>
                    PLAY AGAIN
                  </button>
                  <button type="button" className="ov-ghost" onClick={quit}>
                    BACK TO DEMO
                  </button>
                </div>
              </div>
            )}

            {mode === 'playing' && !coarse && (
              <button type="button" className="cab-pause" onClick={pause}>
                ❚❚ PAUSE (P)
              </button>
            )}
          </div>

          {coarse ? (
            <div className={`gamepad ${mode === 'playing' ? 'is-live' : ''}`}>
              <Stick engine={engine} />
              <div className="pad-mid">
                {mode === 'playing' ? (
                  <button type="button" className="pad-pause" onClick={pause}>
                    PAUSE
                  </button>
                ) : (
                  <span>RNM-16</span>
                )}
              </div>
              <div className="pad-btns">
                <PadButton label="B" sub="PASS" btn="pass" engine={engine} />
                <PadButton label="A" sub="SHOOT" btn="shoot" engine={engine} />
              </div>
            </div>
          ) : (
            <p className="cab-keys" aria-label="Controls">
              <span>
                <kbd>←</kbd>
                <kbd>↑</kbd>
                <kbd>↓</kbd>
                <kbd>→</kbd> MOVE
              </span>
              <span>
                <kbd>Z</kbd> PASS / SWITCH
              </span>
              <span>
                <kbd>X</kbd> HOLD TO SHOOT · TACKLE
              </span>
              <span>
                <kbd>P</kbd> PAUSE
              </span>
            </p>
          )}
        </div>

        <aside className="board" aria-labelledby="board-title">
          <h3 id="board-title" className="board-title">
            WORLD RANKINGS
          </h3>
          <p className="board-src">{board.local ? 'OFFLINE PREVIEW · SAVED IN THIS BROWSER' : 'LIVE FROM MONGODB'}</p>
          <ol className="board-list">
            {board.loaded && board.scores.length === 0 && <li className="board-empty">NO SCORES YET. BE THE FIRST.</li>}
            {!board.loaded && <li className="board-empty">LOADING…</li>}
            {board.scores.map((s, i) => (
              <li key={`${s.initials}-${s.createdAt}-${i}`} className={i < 3 ? `top-${i + 1}` : ''}>
                <span className="b-rank">{String(i + 1).padStart(2, '0')}</span>
                <span className="b-ini">{s.initials}</span>
                <span className="b-res">
                  {s.gf}-{s.ga}
                </span>
                <span className="b-pts">{String(s.points).padStart(5, '0')}</span>
              </li>
            ))}
          </ol>
          <p className="board-rules">GOAL 100 · MARGIN 50 · WIN 150 · DRAW 50</p>
        </aside>
      </div>
    </section>
  );
}
