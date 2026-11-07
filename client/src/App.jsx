import { useEffect, useRef, useState } from 'react';
import { GameStateProvider, useActions } from './lib/state';
import { initMotion, lockScroll, prefersReduced, ScrollTrigger, unlockScroll } from './lib/motion';
import { bundledContent, fetchContent, fetchHealth } from './lib/api';
import { sfx } from './lib/audio';
import { useMedia } from './lib/hooks';
import CRTOverlay from './components/CRTOverlay';
import Cursor from './components/Cursor';
import Header from './components/Header';
import PauseMenu from './components/PauseMenu';
import CoinTab from './components/CoinTab';
import Toasts from './components/Toasts';
import Boot from './components/Boot';
import Hero from './sections/Hero';
import About from './sections/About';
import PlayerArena from './sections/PlayerArena';
import Manual from './sections/Manual';
import StageSelect from './sections/StageSelect';
import Quests from './sections/Quests';
import HallOfFame from './sections/HallOfFame';
import Arcade from './sections/Arcade';
import Glimpse from './sections/Glimpse';
import Continue from './sections/Continue';
import MobileNav from './mobile/MobileNav';
import MBio from './mobile/MBio';
import MSkills from './mobile/MSkills';
import MQuests from './mobile/MQuests';
import MFame from './mobile/MFame';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

function Shell() {
  const [content, setContent] = useState(bundledContent);
  const [boot, setBoot] = useState(prefersReduced ? 'done' : 'booting'); // booting → revealing → done
  const [host, setHost] = useState(undefined);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const headerLogo = useRef(null);
  const bootRef = useRef(boot);
  const actions = useActions();
  // chapter mode: phones in portrait, and phones held sideways (too short for the desktop pins)
  const mobile = useMedia('(max-width: 720px), (pointer: coarse) and (max-height: 520px)');
  bootRef.current = boot;

  useEffect(() => {
    document.documentElement.classList.toggle('m-mode', mobile);
    const id = setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => clearTimeout(id);
  }, [mobile]);

  // content + host info (content only swaps in if it lands while the boot screen is up)
  useEffect(() => {
    fetchContent().then((data) => {
      if (!data) return;
      setResumeAvailable(!!data.resumeAvailable);
      const { resumeAvailable: _r, ...rest } = data;
      // server copy wins, but anything it lacks (e.g. an older seeded DB) falls back to the bundled copy
      if (bootRef.current === 'booting' && JSON.stringify(rest) !== JSON.stringify(bundledContent)) setContent({ ...bundledContent, ...rest });
    });
    fetchHealth().then((h) => setHost(h ? h.host : null));
  }, []);

  useEffect(() => {
    initMotion();
    if (boot === 'booting') lockScroll('boot');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (boot === 'done') {
      unlockScroll('boot');
      actions.enterStage('1-1');
      const refresh = () => ScrollTrigger.refresh();
      document.fonts?.ready.then(refresh);
      setTimeout(refresh, 300);
    }
  }, [boot, actions]);

  // Konami code → palette cheat
  useEffect(() => {
    let i = 0;
    const onKey = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      i = k === KONAMI[i] ? i + 1 : k === KONAMI[0] ? 1 : 0;
      if (i === KONAMI.length) {
        i = 0;
        sfx.cheat();
        actions.setPalette('dmg');
        actions.unlock('konami');
        document.documentElement.classList.add('cheat-flash');
        setTimeout(() => document.documentElement.classList.remove('cheat-flash'), 700);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);

  // hover blips on interactive elements
  useEffect(() => {
    const over = (e) => {
      if (e.target.closest?.('a, button')) sfx.blip();
    };
    document.addEventListener('pointerover', over, { passive: true });
    return () => document.removeEventListener('pointerover', over);
  }, []);

  const c = content;
  const revealed = boot !== 'booting';
  const chapters = c.mobile?.chapters?.length ? c.mobile.chapters : bundledContent.mobile.chapters;
  const T = chapters.length;

  return (
    <>
      <a className="skip-link" href={mobile ? '#m-bio' : '#bio'}>
        Skip to content
      </a>
      <Header ref={headerLogo} logo={c.person.logotype} booted={boot === 'done'} revealed={revealed} />
      <PauseMenu mobile={mobile} />
      {mobile ? <MobileNav chapters={chapters} /> : <CoinTab initial={c.person.shortName[0]} text={c.person.availability} />}
      <Toasts />
      {boot !== 'done' && (
        <Boot logo={c.person.logotype} host={host} onReveal={() => setBoot('revealing')} onExit={() => setBoot('done')} />
      )}
      <main id="main">
        <Hero content={c} revealed={revealed} mobile={mobile} />
        {mobile ? (
          <>
            <MBio content={c} chapter={chapters[0]} index={1} total={T} />
            <MSkills content={c} chapter={chapters[1]} index={2} total={T} />
            <MQuests content={c} chapter={chapters[2]} index={3} total={T} />
            <MFame content={c} chapter={chapters[3]} index={4} total={T} />
            <Arcade content={c} chapterNo={{ index: 5, total: T }} />
            <Continue content={c} resumeAvailable={resumeAvailable} chapterNo={{ index: 6, total: T }} />
          </>
        ) : (
          <>
            <About content={c} />
            <PlayerArena content={c} />
            <Manual content={c} />
            <StageSelect content={c} />
            <Quests content={c} />
            <HallOfFame content={c} />
            <Arcade content={c} />
            <Glimpse content={c} />
            <Continue content={c} resumeAvailable={resumeAvailable} />
          </>
        )}
      </main>
      <CRTOverlay />
      <Cursor />
    </>
  );
}

export default function App() {
  return (
    <GameStateProvider>
      <Shell />
    </GameStateProvider>
  );
}
