import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import PixelText from './PixelText';
import { prefersReduced } from '../lib/motion';

// The colours the logo switches between, one per wall it hits.
const COLORS = ['#e9b250', '#3de8ff', '#ff3b5c', '#2fbf71', '#b18cff', '#f2eee6'];
const IGNORED_KEYS = ['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock'];

/**
 * The old "no disc / no signal" screensaver: the logotype drifts around the whole screen,
 * bounces off the edges and changes colour on every bounce (a perfect corner hit is counted).
 *
 *  title       the word under the logo, e.g. NO SIGNAL / WEAK SIGNAL
 *  hint        one line of explanation at the bottom
 *  actionLabel button text; with onAction, a tap anywhere or any key does the same
 */
export default function NoSignal({ logo = 'RUDRA', title, hint, actionLabel, onAction, busy = false }) {
  const stage = useRef(null);
  const mark = useRef(null);
  const [corners, setCorners] = useState(0);

  useLayoutEffect(() => {
    const box = stage.current;
    const el = mark.current;
    let color = Math.floor(Math.random() * COLORS.length);
    el.style.setProperty('--ns-color', COLORS[color]);

    let W = 0;
    let H = 0;
    let w = 0;
    let h = 0;
    const measure = () => {
      W = box.clientWidth;
      H = box.clientHeight;
      w = el.offsetWidth;
      h = el.offsetHeight;
    };
    measure();

    let x = Math.max(0, (W - w) / 2);
    let y = Math.max(0, (H - h) / 2);
    const place = () => {
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    };
    place();
    if (prefersReduced) {
      const ro = new ResizeObserver(() => {
        measure();
        x = Math.max(0, (W - w) / 2);
        y = Math.max(0, (H - h) / 2);
        place();
      });
      ro.observe(box);
      return () => ro.disconnect();
    }

    // start somewhere random, heading roughly diagonally, at a speed that suits the screen
    x = Math.random() * Math.max(0, W - w);
    y = Math.random() * Math.max(0, H - h);
    const speed = Math.min(190, Math.max(85, Math.hypot(W, H) * 0.085));
    const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.45;
    let vx = speed * Math.cos(angle) * (Math.random() < 0.5 ? -1 : 1);
    let vy = speed * Math.sin(angle) * (Math.random() < 0.5 ? -1 : 1);

    const nextColor = () => {
      color = (color + 1 + Math.floor(Math.random() * (COLORS.length - 1))) % COLORS.length;
      el.style.setProperty('--ns-color', COLORS[color]);
    };

    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000); // a hidden tab doesn't make it jump
      last = now;
      const maxX = Math.max(0, W - w);
      const maxY = Math.max(0, H - h);
      x += vx * dt;
      y += vy * dt;
      let hitX = false;
      let hitY = false;
      if (x <= 0 || x >= maxX) {
        x = x <= 0 ? 0 : maxX;
        vx = x === 0 ? Math.abs(vx) : -Math.abs(vx);
        hitX = true;
      }
      if (y <= 0 || y >= maxY) {
        y = y <= 0 ? 0 : maxY;
        vy = y === 0 ? Math.abs(vy) : -Math.abs(vy);
        hitY = true;
      }
      if (hitX || hitY) {
        nextColor();
        const atEdgeX = x <= 3 || x >= maxX - 3;
        const atEdgeY = y <= 3 || y >= maxY - 3;
        if (atEdgeX && atEdgeY) {
          setCorners((n) => n + 1);
          el.classList.remove('is-corner');
          void el.offsetWidth; // restart the flash
          el.classList.add('is-corner');
        }
      }
      place();
    };
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      measure();
      x = Math.min(x, Math.max(0, W - w));
      y = Math.min(y, Math.max(0, H - h));
    });
    ro.observe(box);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // Any key does the action too. Listening in the capture phase and stopping the event
  // means that key doesn't also reach the page underneath (P wouldn't open the pause menu).
  useEffect(() => {
    if (!onAction) return undefined;
    const onKey = (e) => {
      if (IGNORED_KEYS.includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!busy && !e.repeat) onAction();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onAction, busy]);

  return (
    <div
      className={`nosignal ${onAction ? 'is-actionable' : ''}`}
      ref={stage}
      role="alert"
      aria-live="assertive"
      onClick={onAction && !busy ? onAction : undefined}
    >
      <div className="ns-mark" ref={mark} aria-hidden="true">
        <PixelText lines={[logo]} decorative className="ns-logo" />
        <span className="ns-title">{title}</span>
      </div>

      <p className="ns-osd" aria-hidden="true">
        CH 03 · RNM-TV
      </p>
      {corners > 0 ? (
        <p className="ns-corners" aria-hidden="true">
          CORNER HIT ×{corners}
        </p>
      ) : null}

      <div className="ns-foot">
        <p className="sr-only">{title}.</p>
        {hint ? <p className="ns-hint">{hint}</p> : null}
        {onAction ? (
          <button
            type="button"
            className="ns-action"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onAction();
            }}
          >
            {busy ? 'TUNING IN…' : `▶ ${actionLabel}`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
