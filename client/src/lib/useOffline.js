import { useEffect, useState } from 'react';

/**
 * Tracks whether the browser has lost its connection. A drop has to last `delay` ms to count,
 * so a laptop waking up or a wifi hand-over doesn't flash the screen.
 * → { offline, episode }  (episode goes up by one each time the connection drops)
 */
export function useOffline(delay = 1500) {
  const [state, setState] = useState({ offline: false, episode: 0 });

  useEffect(() => {
    let timer = 0;
    const onOffline = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!navigator.onLine) setState((s) => (s.offline ? s : { offline: true, episode: s.episode + 1 }));
      }, delay);
    };
    const onOnline = () => {
      clearTimeout(timer);
      setState((s) => (s.offline ? { ...s, offline: false } : s));
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [delay]);

  return state;
}
