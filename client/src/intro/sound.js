// Sounds for the power-on intro, all synthesized (no samples): the pad's button,
// the console's power switch, the disc spinning up, the CRT thunk and degauss hum,
// an original boot swell, the dive into the screen and the picture opening.
import { audioContext, audioNoise, soundOn } from '../lib/audio';

let bus = null;

function out() {
  if (!soundOn()) return null;
  const ctx = audioContext();
  if (!ctx) return null;
  if (!bus) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    bus = ctx.createGain();
    bus.gain.value = 0.36;
    bus.connect(comp).connect(ctx.destination);
  }
  return ctx;
}

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

function env(ctx, t, attack, peak, decay, dest = bus) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(dest);
  return g;
}

function osc(ctx, type, f, t, dur, dest) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

function hiss(ctx, t, dur, dest, { type = 'highpass', freq = 2000, q = 0.7 } = {}) {
  const s = ctx.createBufferSource();
  s.buffer = audioNoise();
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  f.Q.value = q;
  s.connect(f).connect(dest);
  s.start(t, Math.random() * 0.8);
  s.stop(t + dur + 0.05);
  return f;
}

const sounds = {
  /** The START button on the pad: a plastic click and a little confirm blip. */
  press() {
    const ctx = out();
    if (!ctx) return;
    const t = ctx.currentTime;
    hiss(ctx, t, 0.03, env(ctx, t, 0.001, 0.35, 0.025), { freq: 3200 });
    osc(ctx, 'square', 988, t + 0.02, 0.05, env(ctx, t + 0.02, 0.002, 0.09, 0.05));
    osc(ctx, 'square', 1480, t + 0.07, 0.07, env(ctx, t + 0.07, 0.002, 0.08, 0.07));
  },

  /** Console power switch: a mechanical clack and the thump of the supply. */
  power() {
    const ctx = out();
    if (!ctx) return;
    const t = ctx.currentTime;
    hiss(ctx, t, 0.06, env(ctx, t, 0.001, 0.5, 0.05), { type: 'bandpass', freq: 1700, q: 1.3 });
    const o = osc(ctx, 'sine', 150, t + 0.01, 0.25, env(ctx, t + 0.01, 0.003, 0.75, 0.22));
    o.frequency.exponentialRampToValueAtTime(42, t + 0.2);
  },

  /** The disc spinning up, with the laser seeking a couple of times. */
  spin() {
    const ctx = out();
    if (!ctx) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.45);
    g.gain.setValueAtTime(0.11, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    g.connect(bus);
    const f = hiss(ctx, t, 1.9, g, { type: 'bandpass', freq: 240, q: 5 });
    f.frequency.exponentialRampToValueAtTime(1350, t + 1.3);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(0.0001, t);
    mg.gain.exponentialRampToValueAtTime(0.05, t + 0.5);
    mg.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    lp.connect(mg).connect(bus);
    const m = osc(ctx, 'sawtooth', 36, t, 1.8, lp);
    m.frequency.exponentialRampToValueAtTime(98, t + 1.2);
    for (const dt of [0.55, 0.66, 1.15]) hiss(ctx, t + dt, 0.02, env(ctx, t + dt, 0.001, 0.16, 0.018), { freq: 3600 });
  },

  /** The tube waking up: a low thunk, the degauss hum and a breath of static. */
  crtOn() {
    const ctx = out();
    if (!ctx) return;
    const t = ctx.currentTime;
    const th = osc(ctx, 'sine', 90, t, 0.32, env(ctx, t, 0.003, 0.85, 0.3));
    th.frequency.exponentialRampToValueAtTime(36, t + 0.22);
    // degauss: a 60 Hz hum, amplitude-wobbled, dying away
    const hum = ctx.createGain();
    hum.gain.value = 0;
    const he = env(ctx, t + 0.05, 0.04, 0.26, 0.95);
    hum.connect(he);
    osc(ctx, 'sine', 60, t + 0.05, 1.05, hum);
    osc(ctx, 'sine', 120, t + 0.05, 1.05, hum);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 11;
    lfo.connect(hum.gain);
    lfo.start(t + 0.05);
    lfo.stop(t + 1.15);
    hiss(ctx, t + 0.04, 0.5, env(ctx, t + 0.04, 0.004, 0.13, 0.45), { freq: 2600 });
    osc(ctx, 'sine', 7800, t + 0.1, 1.4, env(ctx, t + 0.1, 0.08, 0.006, 1.3));
  },

  /** The boot swell (an original chord, not anybody's jingle): a warm pad opening up,
   *  a shimmer of bells as the logo lands, and a deep note under it. */
  chime() {
    const ctx = out();
    if (!ctx) return;
    const t = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.9;
    lp.frequency.setValueAtTime(240, t);
    lp.frequency.exponentialRampToValueAtTime(3400, t + 1.15);
    lp.frequency.exponentialRampToValueAtTime(1300, t + 2.9);
    const pad = ctx.createGain();
    pad.gain.setValueAtTime(0.0001, t);
    pad.gain.exponentialRampToValueAtTime(1, t + 0.95);
    pad.gain.setValueAtTime(1, t + 1.9);
    pad.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    lp.connect(pad).connect(bus);
    for (const m of [41, 48, 55, 57, 64, 67, 71]) {
      for (const cents of [-7, 7]) {
        const g = ctx.createGain();
        g.gain.value = m < 50 ? 0.05 : 0.035;
        g.connect(lp);
        osc(ctx, 'sawtooth', mtof(m), t, 3.4, g).detune.value = cents;
      }
    }
    // shimmer through a little echo
    const dly = ctx.createDelay(1);
    dly.delayTime.value = 0.21;
    const fb = ctx.createGain();
    fb.gain.value = 0.36;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    dly.connect(fb).connect(dly);
    dly.connect(wet).connect(bus);
    [76, 79, 83, 86, 88, 91].forEach((m, i) => {
      const at = t + 0.78 + i * 0.085;
      const g = env(ctx, at, 0.004, 0.12, 0.9);
      g.connect(dly);
      osc(ctx, 'triangle', mtof(m), at, 1, g);
      osc(ctx, 'sine', mtof(m + 12), at, 0.6, env(ctx, at, 0.003, 0.03, 0.5));
    });
    osc(ctx, 'sine', mtof(29), t + 1.12, 1.7, env(ctx, t + 1.12, 0.01, 0.5, 1.6));
  },

  /** Diving into the screen. */
  whoosh(dur = 1) {
    const ctx = out();
    if (!ctx) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + dur * 0.88);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    g.connect(bus);
    const f = hiss(ctx, t, dur + 0.1, g, { type: 'bandpass', freq: 320, q: 1.3 });
    f.frequency.exponentialRampToValueAtTime(4800, t + dur);
    const o = osc(ctx, 'sine', 180, t, dur, env(ctx, t, dur * 0.8, 0.07, dur * 0.25));
    o.frequency.exponentialRampToValueAtTime(880, t + dur);
  },

  /** The site switching on: a soft CRT zap. */
  open() {
    const ctx = out();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = osc(ctx, 'sine', 1700, t, 0.2, env(ctx, t, 0.002, 0.2, 0.18));
    o.frequency.exponentialRampToValueAtTime(260, t + 0.18);
    hiss(ctx, t, 0.04, env(ctx, t, 0.001, 0.12, 0.035), { freq: 4200 });
  },

  /** Fade out whatever is still ringing (skip). */
  stop() {
    const ctx = audioContext();
    if (!ctx || !bus) return;
    const b = bus;
    bus = null;
    b.gain.cancelScheduledValues(ctx.currentTime);
    b.gain.setValueAtTime(b.gain.value, ctx.currentTime);
    b.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
    setTimeout(() => b.disconnect(), 400);
  },
};

// The intro's timeline calls these at set moments. A sound that fails (a browser that refuses
// Web Audio, a node it doesn't support) must never stop the picture, so every call is guarded.
export const introSound = Object.fromEntries(
  Object.entries(sounds).map(([name, play]) => [
    name,
    (...args) => {
      try {
        play(...args);
      } catch {
        /* no sound this time; the intro carries on */
      }
    },
  ]),
);
