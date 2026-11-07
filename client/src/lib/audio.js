// Tiny chiptune SFX engine — square/triangle oscillators and filtered noise,
// synthesized on the fly (no audio files). Nothing is created until the
// visitor's first tap/click/key (browsers require a gesture before audio).
let ctx = null;
let master = null;
let noiseBuf = null;
let enabled = false;
let crowd = null;
let unlocked = false;

// Browsers only let audio start inside a real gesture (a tap's touchend, a mouse
// press, a key). A touch pointerdown or a scroll doesn't count, so we wait for one.
const inGesture = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userActivation : undefined;
  return !ua || ua.isActive;
};

/** Call from inside a user gesture. Creates/resumes the context; safe to call repeatedly. */
export function unlockAudio() {
  if (!inGesture()) return null;
  unlocked = true;
  try {
    // iOS: let Web Audio play even when the ringer switch is on silent
    if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
  } catch {
    /* not supported */
  }
  return ensure();
}
export const audioRunning = () => !!ctx && ctx.state === 'running';
export const audioUnlocked = () => unlocked;
export const audioContext = () => ensure();
export const audioNoise = () => (ensure(), noiseBuf);

function ensure() {
  if (!unlocked) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  // suspended (or 'interrupted' on iOS after a call): only a gesture can wake it
  if (ctx.state !== 'running' && ctx.state !== 'closed' && inGesture()) ctx.resume().catch(() => {});
  return ctx;
}

export function setSoundEnabled(on) {
  enabled = !!on;
  if (!enabled) crowdStop();
}
export const soundOn = () => enabled;

function tone({ f = 440, type = 'square', dur = 0.08, vol = 0.5, slide = 0, delay = 0, vib = 0 }) {
  if (!enabled || !ensure()) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const gn = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
  if (vib) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = vib;
    lg.gain.value = f * 0.06;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.02);
  }
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn).connect(master);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function noise({ dur = 0.15, vol = 0.4, freq = 900, q = 0.8, type = 'lowpass', sweep = 0, delay = 0 }) {
  if (!enabled || !ensure()) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(gn).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

const arp = (notes, step = 0.07, opts = {}) => notes.forEach((f, i) => tone({ f, dur: step * 1.6, delay: i * step, vol: 0.35, ...opts }));

let lastBlip = 0;
export const sfx = {
  blip() {
    const now = performance.now();
    if (now - lastBlip < 70) return;
    lastBlip = now;
    tone({ f: 1320, dur: 0.03, vol: 0.12 });
  },
  select: () => { tone({ f: 660, dur: 0.05, vol: 0.3 }); tone({ f: 990, dur: 0.08, vol: 0.3, delay: 0.05 }); },
  back: () => { tone({ f: 660, dur: 0.05, vol: 0.25 }); tone({ f: 440, dur: 0.08, vol: 0.25, delay: 0.05 }); },
  start: () => arp([523, 659, 784, 1047, 1319], 0.065),
  coin: () => { tone({ f: 988, dur: 0.08, vol: 0.35 }); tone({ f: 1319, dur: 0.4, vol: 0.35, delay: 0.08 }); },
  achievement: () => arp([784, 988, 1175, 1568], 0.06, { type: 'triangle' }),
  error: () => tone({ f: 140, dur: 0.22, vol: 0.4, type: 'sawtooth', slide: -60 }),
  cheat: () => arp([392, 523, 659, 784, 1047, 784, 1047, 1319], 0.05),
  // football
  whistle: (n = 1) => { for (let i = 0; i < n; i++) tone({ f: 2350, dur: n > 1 && i === n - 1 ? 0.7 : 0.22, vol: 0.22, type: 'sine', vib: 34, delay: i * 0.3 }); },
  kick: (power = 0.5) => { noise({ dur: 0.07, vol: 0.5 * (0.6 + power), freq: 600, type: 'lowpass' }); tone({ f: 150, dur: 0.08, vol: 0.4, type: 'triangle', slide: -80 }); },
  bounce: () => tone({ f: 220, dur: 0.04, vol: 0.12, type: 'triangle', slide: -60 }),
  save: () => { noise({ dur: 0.12, vol: 0.4, freq: 1200, type: 'bandpass' }); tone({ f: 330, dur: 0.1, vol: 0.25, slide: -120 }); },
  post: () => { tone({ f: 1760, dur: 0.25, vol: 0.25, type: 'triangle' }); tone({ f: 2637, dur: 0.18, vol: 0.12, type: 'sine' }); },
  goal: () => {
    noise({ dur: 2.4, vol: 0.55, freq: 700, sweep: 1600, type: 'bandpass', q: 0.4 });
    arp([523, 659, 784, 1047, 784, 1047, 1319, 1568], 0.09);
  },
  groan: () => noise({ dur: 1.1, vol: 0.4, freq: 900, sweep: -600, type: 'bandpass', q: 0.5 }),
};

export function crowdStart() {
  if (!enabled || !ensure() || crowd) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 650;
  f.Q.value = 0.35;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 1.2);
  src.connect(f).connect(g).connect(master);
  src.start();
  crowd = { src, g };
}

export function crowdStop() {
  if (!crowd || !ctx) return;
  const { src, g } = crowd;
  crowd = null;
  try {
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    src.stop(ctx.currentTime + 0.45);
  } catch {
    /* already stopped */
  }
}
