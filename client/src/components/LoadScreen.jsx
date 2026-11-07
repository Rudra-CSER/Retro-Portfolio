import NoSignal from './NoSignal';

/**
 * What shows before the site can render:
 *  - the first moments of loading: a quiet LOADING…
 *  - a slow connection (still loading after 2.5 s): the bouncing WEAK SIGNAL screen
 *  - no connection / server unreachable: the bouncing NO SIGNAL screen, retrying by itself
 *  - a crash in the app itself: SYSTEM ERROR with a reload button
 */
export default function LoadScreen({ status = 'loading', slow = false, failures = 0, message, onRetry }) {
  if (status === 'crash') {
    return (
      <div className="load-screen is-error" role="alert">
        <p className="load-title">SYSTEM ERROR</p>
        <p className="load-msg">{(message || 'Something went wrong.').toUpperCase()}</p>
        <button type="button" className="load-retry" onClick={() => window.location.reload()}>
          ▶ RELOAD
        </button>
      </div>
    );
  }

  if (failures > 0) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return (
      <NoSignal
        title="NO SIGNAL"
        hint={
          offline
            ? "YOU'RE OFFLINE · THE SITE LOADS BY ITSELF WHEN YOU'RE BACK ONLINE"
            : `${message || 'Could not reach the server.'} Retrying by itself.`.toUpperCase()
        }
        actionLabel="TRY NOW"
        onAction={onRetry}
        busy={status === 'loading'}
      />
    );
  }

  if (slow) {
    return <NoSignal title="WEAK SIGNAL" hint="SLOW CONNECTION · STILL LOADING…" />;
  }

  return (
    <div className="load-screen" role="status" aria-live="polite">
      <p className="load-title">
        LOADING<span className="load-dots" aria-hidden="true" />
      </p>
    </div>
  );
}
