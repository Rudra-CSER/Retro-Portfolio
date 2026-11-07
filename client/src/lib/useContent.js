import { useCallback, useEffect, useState } from 'react';
import { getContent } from './api';

// After this long without content (counted from when the page started loading), the
// loading screen turns into the bouncing WEAK SIGNAL screen. index.html uses the same delay.
const SLOW_AFTER_MS = 2500;
const PAGE_WAS_SLOW = typeof performance !== 'undefined' && performance.now() > SLOW_AFTER_MS;

/**
 * Loads the site content from GET /api/content.
 * → { status: 'loading' | 'ready' | 'error', content, error, failures, slow, retry }
 * After a failure it tries again by itself: as soon as the browser is back online,
 * and every few seconds anyway (4 s, 8 s, 16 s, then every 30 s).
 */
export function useContent() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', content: null, error: null, failures: 0 });
  const [slow, setSlow] = useState(PAGE_WAS_SLOW);

  useEffect(() => {
    let current = true;
    getContent().then(
      (content) => current && setState((s) => ({ ...s, status: 'ready', content, error: null })),
      (error) => current && setState((s) => ({ ...s, status: 'error', error, failures: s.failures + 1 })),
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (slow || state.status === 'ready') return undefined;
    const id = setTimeout(() => setSlow(true), Math.max(0, SLOW_AFTER_MS - performance.now()));
    return () => clearTimeout(id);
  }, [slow, state.status]);

  const retry = useCallback(() => {
    setState((s) => (s.status === 'error' ? { ...s, status: 'loading' } : s)); // keeps the last error on screen while it retries
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (state.status !== 'error') return undefined;
    const id = setTimeout(retry, Math.min(30_000, 4000 * 2 ** (state.failures - 1)));
    window.addEventListener('online', retry);
    return () => {
      clearTimeout(id);
      window.removeEventListener('online', retry);
    };
  }, [state.status, state.failures, retry]);

  return { ...state, slow, retry };
}
