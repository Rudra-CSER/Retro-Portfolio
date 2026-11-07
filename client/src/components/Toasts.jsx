import { useGame } from '../lib/state';
import Sprite from './Sprite';

export default function Toasts() {
  const { toasts } = useGame();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind || 'info'}`}>
          <Sprite name={t.kind === 'achievement' ? 'trophy' : 'coin'} className="toast-icon" />
          <div>
            <small>{t.kind === 'achievement' ? 'ACHIEVEMENT UNLOCKED' : t.kicker || 'NOTICE'}</small>
            <strong>{t.title}</strong>
          </div>
          {t.points ? <b className="toast-pts">+{t.points}</b> : null}
        </div>
      ))}
    </div>
  );
}
