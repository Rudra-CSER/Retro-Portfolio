import { useEffect, useMemo, useRef, useState } from 'react';
import { GameStateProvider, useActions } from './lib/state';
import { initMotion, lockScroll, prefersReduced, ScrollTrigger, unlockScroll } from './lib/motion';
import { useContent } from './lib/useContent';
import { useOffline } from './lib/useOffline';
import { sfx } from './lib/audio';
import { useMedia } from './lib/hooks';
import ErrorBoundary, { SectionCrash } from './components/ErrorBoundary';
import LoadScreen from './components/LoadScreen';
import NoSignal from './components/NoSignal';
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

// Section ids of the phone chapters, in page order. Their words live in site.json → mobile.chapters.
const CHAPTER_IDS = ['m-bio', 'm-skills', 'm-quests', 'm-fame', 'arcade', 'continue'];

/** If one section crashes, it shows a small error card and the rest of the page keeps working. */
function Guard({ name, children }) {
  return (
    <ErrorBoundary name={name} fallback={<SectionCrash name={name} />}>
      {children}
    </ErrorBoundary>
  );
}

function Shell({ content: c }) {
  const [boot, setBoot] = useState(prefersReduced ? 'done' : 'booting'); // booting → revealing → done
  const headerLogo = useRef(null);
  const actions = useActions();
  // chapter mode: phones in portrait, and phones held sideways (too short for the desktop pins)
  const mobile = useMedia('(max-width: 720px), (pointer: coarse) and (max-height: 520px)');
  const chapters = useMemo(() => CHAPTER_IDS.map((id, i) => ({ id, ...c.mobile.chapters[i] })), [c]);
  const T = chapters.length;
  // connection lost while browsing: the NO SIGNAL screen until it's back (or the visitor waves it off)
  const { offline, episode } = useOffline();
  const [dismissedEpisode, setDismissedEpisode] = useState(0);
  const showOffline = offline && dismissedEpisode !== episode;

  useEffect(() => {
    if (!showOffline) return undefined;
    lockScroll('offline');
    return () => unlockScroll('offline');
  }, [showOffline]);

  useEffect(() => {
    document.documentElement.classList.toggle('m-mode', mobile);
    const id = setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => clearTimeout(id);
  }, [mobile]);

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
      const id = setTimeout(refresh, 300);
      return () => clearTimeout(id);
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

  const revealed = boot !== 'booting';

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
        // If the intro itself breaks, skip straight to the site.
        <ErrorBoundary name="intro" onError={() => setBoot('done')}>
          <Boot logo={c.person.logotype} servedFrom={c.boot.servedFrom} onReveal={() => setBoot('revealing')} onExit={() => setBoot('done')} />
        </ErrorBoundary>
      )}
      <main id="main">
        <Guard name="TITLE">
          <Hero content={c} revealed={revealed} mobile={mobile} />
        </Guard>
        {mobile ? (
          <>
            <Guard name="BIO">
              <MBio content={c} chapter={chapters[0]} index={1} total={T} />
            </Guard>
            <Guard name="ABILITIES">
              <MSkills content={c} chapter={chapters[1]} index={2} total={T} />
            </Guard>
            <Guard name="QUESTS">
              <MQuests content={c} chapter={chapters[2]} index={3} total={T} />
            </Guard>
            <Guard name="HALL OF FAME">
              <MFame content={c} chapter={chapters[3]} index={4} total={T} />
            </Guard>
            <Guard name="BONUS STAGE">
              <Arcade content={c} chapterNo={{ index: 5, total: T }} />
            </Guard>
            <Guard name="CONTACT">
              <Continue content={c} chapterNo={{ index: 6, total: T }} />
            </Guard>
          </>
        ) : (
          <>
            <Guard name="BIO">
              <About content={c} />
            </Guard>
            <Guard name="ABILITIES">
              <PlayerArena content={c} />
            </Guard>
            <Guard name="MANUAL">
              <Manual content={c} />
            </Guard>
            <Guard name="STAGE SELECT">
              <StageSelect content={c} />
            </Guard>
            <Guard name="QUESTS">
              <Quests content={c} />
            </Guard>
            <Guard name="HALL OF FAME">
              <HallOfFame content={c} />
            </Guard>
            <Guard name="BONUS STAGE">
              <Arcade content={c} />
            </Guard>
            <Guard name="MORE">
              <Glimpse content={c} />
            </Guard>
            <Guard name="CONTACT">
              <Continue content={c} />
            </Guard>
          </>
        )}
      </main>
      {/* decorative layers: if they fail, the site simply goes without them */}
      <ErrorBoundary name="crt overlay">
        <CRTOverlay />
      </ErrorBoundary>
      <ErrorBoundary name="cursor">
        <Cursor />
      </ErrorBoundary>
      {showOffline && (
        <NoSignal
          logo={c.person.logotype}
          title="NO SIGNAL"
          hint="YOU'RE OFFLINE · THIS CLEARS BY ITSELF WHEN YOU'RE BACK"
          actionLabel="KEEP READING OFFLINE"
          onAction={() => setDismissedEpisode(episode)}
        />
      )}
    </>
  );
}

export default function App() {
  const { status, content, error, failures, slow, retry } = useContent();
  if (status !== 'ready') return <LoadScreen status={status} slow={slow} failures={failures} message={error?.message} onRetry={retry} />;
  return (
    <ErrorBoundary name="the site" fallback={<LoadScreen status="crash" message="The page hit a bug and stopped." />}>
      <GameStateProvider>
        <Shell content={content} />
      </GameStateProvider>
    </ErrorBoundary>
  );
}
