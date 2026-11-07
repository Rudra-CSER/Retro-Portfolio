import { Component } from 'react';

/**
 * Catches a crash inside one part of the page so the rest keeps working.
 * Renders `fallback` instead (nothing by default) and calls `onError` once.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[RUDRA.ROM] ${this.props.name || 'a section'} crashed:`, error, info?.componentStack);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.error) return this.props.fallback ?? null;
    return this.props.children;
  }
}

/** The stand-in for a section that crashed: a small "cartridge error" card. */
export function SectionCrash({ name }) {
  return (
    <section className="crash-card" role="alert">
      <p className="label">
        <b>[</b> {name} <b>]</b>
      </p>
      <p className="crash-text">THIS STAGE FAILED TO LOAD. THE REST OF THE GAME STILL WORKS.</p>
      <button type="button" className="crash-btn" onClick={() => window.location.reload()}>
        ↻ RELOAD
      </button>
    </section>
  );
}
