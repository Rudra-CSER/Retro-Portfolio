import { useEffect, useState } from 'react';
import { diag } from '../intro/quality';
import { audioState } from '../lib/audio';
import { prefersReduced } from '../lib/motion';

const pad = (s) => s.padEnd(8, ' ');

/**
 * Add ?debug=1 to the address to see what the opening decided on this device and why:
 * the version it played, frame rate and draw time, every step down, and the things that
 * commonly differ between browsers (reduced motion, audio, WebGL for the helix).
 */
export default function IntroDebug() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const helix = document.querySelector('.hero-scene canvas')
    ? 'webgl'
    : document.querySelector('.hero-scene.is-fallback')
      ? 'no webgl (still sprite shown)'
      : 'loading';
  const lines = [
    `${pad('INTRO')}${prefersReduced ? 'skipped: this system asks for reduced motion' : `${(diag.tier || '?').toUpperCase()}  (${diag.source || '?'})`}`,
    diag.reason ? `${pad('WHY')}${diag.reason}` : null,
    diag.fps ? `${pad('FRAMES')}${diag.fps} fps · ${diag.cost} ms per frame · ${diag.res}` : null,
    ...diag.steps.map((s, i) => `${pad(i ? '' : 'STEPS')}${s}`),
    `${pad('AUDIO')}${audioState()}`,
    `${pad('HELIX')}${helix}`,
    `${pad('FX')}${document.documentElement.classList.contains('lite-fx') ? 'lite (still grain)' : 'full'}`,
  ].filter(Boolean);

  return (
    <pre className="debug-panel" aria-hidden="true">
      {lines.join('\n')}
    </pre>
  );
}
