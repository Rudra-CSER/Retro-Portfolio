import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { audioUnlocked, setSoundEnabled, sfx, unlockAudio } from './audio';
import { music as player } from './music';

const StateCtx = createContext(null);
const ActionsCtx = createContext(null);

const load = (k, d) => {
  try {
    const v = localStorage.getItem(`rudra.${k}`);
    return v == null ? d : JSON.parse(v);
  } catch {
    return d;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(`rudra.${k}`, JSON.stringify(v));
  } catch {
    /* storage blocked (private mode, sandbox) */
  }
};

export const PALETTES = ['arcade', 'phosphor', 'cga', 'dmg', 'white'];
export const PALETTE_NAMES = { arcade: 'ARCADE', phosphor: 'PHOSPHOR', cga: 'CGA', dmg: 'POCKET', white: 'WHITE' };
// the colour of each palette's dot in the header switcher (styles/base.css holds the palettes)
export const PALETTE_SWATCHES = {
  arcade: '#e9b250',
  phosphor: '#39ff88',
  cga: 'linear-gradient(135deg, #55ffff 50%, #ff55ff 50%)',
  dmg: '#9bbc0f',
  white: '#f7f4ee',
};

// The opening: AUTO lets the device pick its own version (intro/quality.js); the others fix it.
// Read by intro/quality.js the next time the site opens.
export const INTRO_MODES = ['auto', 'full', 'lite', 'off'];
export const INTRO_NAMES = { auto: 'AUTO', full: 'FULL', lite: 'LITE', off: 'OFF' };

export const ACHIEVEMENTS = {
  kickoff: 'KICK OFF',
  goal: 'FIRST GOAL',
  champion: 'CHAMPION OF PIXEL CUP',
  konami: 'CHEAT CODE ACCEPTED',
  palette: 'PALETTE SWAP',
  contact: 'PLAYER 2 HAS JOINED',
};

export function GameStateProvider({ children }) {
  // Sound defaults ON (new key, so earlier 'off' tests don't stick); nothing plays before the first tap.
  const [sound, setSound] = useState(() => load('snd', true));
  const [music, setMusic] = useState(() => load('music', true));
  const [track, setTrack] = useState(null);
  const [audioReady, setAudioReady] = useState(false);
  const [crt, setCrt] = useState(() => load('crt', true));
  const [palette, setPalette] = useState(() => (PALETTES.includes(load('palette', 'arcade')) ? load('palette', 'arcade') : 'arcade'));
  const [intro, setIntro] = useState(() => (INTRO_MODES.includes(load('intro', 'auto')) ? load('intro', 'auto') : 'auto'));
  const [score, setScore] = useState(0);
  const [savedHi] = useState(() => load('hi', 0));
  const hi = Math.max(savedHi, score);
  const [stage, setStage] = useState('1-1');
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const unlocked = useRef(new Set(load('ach', [])));
  const visited = useRef(new Set());

  useEffect(() => {
    setSoundEnabled(sound);
    save('snd', sound);
  }, [sound]);

  useEffect(() => save('music', music), [music]);

  // the background soundtrack runs when sound + music are on and the browser has let audio start
  useEffect(() => {
    player.set(sound && music && audioReady);
  }, [sound, music, audioReady]);

  useEffect(() => player.subscribe(setTrack), []);

  // browsers only allow audio after a gesture: the first tap/click/key unlocks it
  useEffect(() => {
    const kinds = ['pointerdown', 'touchend', 'click', 'keydown'];
    const onGesture = () => {
      unlockAudio();
      if (audioUnlocked()) setAudioReady(true);
    };
    kinds.forEach((k) => window.addEventListener(k, onGesture, { capture: true, passive: true }));
    return () => kinds.forEach((k) => window.removeEventListener(k, onGesture, { capture: true }));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('no-crt', !crt);
    save('crt', crt);
  }, [crt]);

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.palette = palette;
    save('palette', palette);
    // the browser's own bar (phones) follows the page colour
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(html).getPropertyValue('--bg-0').trim() || '#050505';
    window.dispatchEvent(new CustomEvent('palettechange', { detail: palette }));
  }, [palette]);

  useEffect(() => save('intro', intro), [intro]);

  useEffect(() => {
    if (hi > savedHi) save('hi', hi);
  }, [hi, savedHi]);

  const addScore = useCallback((n) => setScore((s) => s + n), []);

  const toast = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list.slice(-2), { id, ...t }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 3600);
  }, []);

  const unlock = useCallback(
    (id) => {
      if (!ACHIEVEMENTS[id] || unlocked.current.has(id)) return false;
      unlocked.current.add(id);
      save('ach', [...unlocked.current]);
      addScore(1000);
      sfx.achievement();
      toast({ kind: 'achievement', title: ACHIEVEMENTS[id], points: 1000 });
      return true;
    },
    [addScore, toast],
  );

  /** First visit to a stage scores points; every visit updates the HUD. */
  const enterStage = useCallback(
    (code) => {
      setStage(code);
      if (!visited.current.has(code)) {
        visited.current.add(code);
        addScore(500);
      }
    },
    [addScore],
  );

  const cyclePalette = useCallback(() => {
    setPalette((p) => PALETTES[(PALETTES.indexOf(p) + 1) % PALETTES.length]);
  }, []);

  const cycleIntro = useCallback(() => {
    setIntro((m) => INTRO_MODES[(INTRO_MODES.indexOf(m) + 1) % INTRO_MODES.length]);
  }, []);

  const nextTrack = useCallback(() => player.next(), []);
  const actions = useMemo(
    () => ({ setSound, setMusic, nextTrack, setCrt, setPalette, cyclePalette, cycleIntro, addScore, enterStage, setMenuOpen, toast, unlock }),
    [nextTrack, cyclePalette, cycleIntro, addScore, enterStage, toast, unlock],
  );
  const state = useMemo(
    () => ({ sound, music, track, crt, palette, intro, score, hi, stage, menuOpen, toasts }),
    [sound, music, track, crt, palette, intro, score, hi, stage, menuOpen, toasts],
  );
  return (
    <ActionsCtx.Provider value={actions}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </ActionsCtx.Provider>
  );
}

/** Stable callbacks only — components using this never re-render on score changes. */
export const useActions = () => useContext(ActionsCtx);
/** Live values + actions (HUD, menu, toasts). */
export const useGame = () => ({ ...useContext(StateCtx), ...useContext(ActionsCtx) });
