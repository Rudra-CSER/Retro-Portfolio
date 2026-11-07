import { useLayoutEffect } from 'react';
import { useActions } from './state';

// One shared, rAF-throttled tracker: the current stage is the section whose top
// is the lowest one still above the 55% line. Pinned sections sit at top 0 for
// the whole pin, so this stays correct through pins and after menu jumps.
const entries = new Set();
let raf = 0;
let current = null;
let listening = false;

function evaluate() {
  raf = 0;
  const line = window.innerHeight * 0.55;
  let best = null;
  let bestTop = -Infinity;
  for (const e of entries) {
    const el = e.ref.current;
    if (!el) continue;
    const top = el.getBoundingClientRect().top;
    if (top <= line && top > bestTop) {
      best = e;
      bestTop = top;
    }
  }
  if (!best || best === current) return;
  current = best;
  best.enterStage(best.code);
  if (best.onFirst && !best.fired) {
    best.fired = true;
    best.unlock(best.onFirst);
  }
}

const schedule = () => {
  if (!raf) raf = requestAnimationFrame(evaluate);
};

/** Registers a section for the HUD "STAGE" readout (first visit scores points, optional achievement). */
export function useStage(ref, code, onFirst) {
  const { enterStage, unlock } = useActions();
  useLayoutEffect(() => {
    const entry = { ref, code, onFirst, enterStage, unlock, fired: false };
    entries.add(entry);
    if (!listening) {
      listening = true;
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);
    }
    schedule();
    return () => {
      entries.delete(entry);
      if (current === entry) current = null;
    };
  }, [ref, code, onFirst, enterStage, unlock]);
}
