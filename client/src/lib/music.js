// Background music: a tiny tracker that compiles the TRACKS into note events and
// schedules them on the Web Audio clock (lookahead scheduling), cycling through
// a shuffled playlist so each visit starts on a different song.
import { audioContext, audioNoise } from './audio';
import { BASS, DRUMS, TRACKS } from './tracks';

// ── compile ────────────────────────────────────────────────────────────────
const SEMI = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6], aug: [0, 4, 8] };
const ARP = { up: [0, 1, 2, 3], updown: [0, 1, 2, 3, 2, 1], alberti: [0, 2, 1, 2] };

const noteMidi = (name) => {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 12 * (Number(m[2]) + 1) + SEMI[m[1]];
};
const parseChord = (name) => {
  const m = /^([A-G](?:#|b)?)(.*)$/.exec(name);
  if (!m || !(m[2] in QUAL)) throw new Error(`bad chord ${name}`);
  const iv = QUAL[m[2]];
  return { root: SEMI[m[1]], tones: iv.length === 4 ? iv : [...iv, 12] };
};
export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

function parseLead(str, spb, bars, where) {
  const out = [];
  let step = 0;
  str.split('|').forEach((bar, bi) => {
    let inBar = 0;
    for (const tok of bar.trim().split(/\s+/).filter(Boolean)) {
      const [n, l] = tok.split(':');
      const len = l ? Number(l) : 1;
      if (n !== '.') out.push({ step: step + inBar, ch: 'lead', midi: noteMidi(n), len });
      inBar += len;
    }
    if (inBar !== spb) throw new Error(`${where}: bar ${bi + 1} has ${inBar} steps, expected ${spb}`);
    step += spb;
  });
  if (step !== bars * spb) throw new Error(`${where}: lead covers ${step / spb} bars, chords have ${bars}`);
  return out;
}

function parsePattern(pat, spb) {
  // → [{i, sym, len}] with '-' extending the previous note
  const out = [];
  let open = null;
  [...pat].forEach((c, i) => {
    if (c === '-') {
      if (open) open.len += 1;
      return;
    }
    open = null;
    if (c === '.') return;
    open = { i, sym: c, len: 1 };
    out.push(open);
  });
  if (pat.length !== spb) throw new Error(`pattern ${pat} is ${pat.length} steps, expected ${spb}`);
  return out;
}

export function compileTrack(t) {
  const spb = t.spb;
  const events = [];
  let bar0 = 0;
  for (const name of t.form) {
    const sec = t.sections[name];
    if (!sec) throw new Error(`${t.id}: missing section ${name}`);
    const chords = sec.chords.split(/\s+/).map(parseChord);
    const bars = chords.length;
    const base = bar0 * spb;
    if (sec.lead) for (const e of parseLead(sec.lead, spb, bars, `${t.id}/${name}`)) events.push({ ...e, step: base + e.step });
    const bassPat = sec.bass ? parsePattern(BASS[sec.bass], spb) : [];
    const drumPat = sec.drums ? parsePattern(DRUMS[sec.drums], spb) : [];
    const style = t.inst.arp?.style;
    chords.forEach((c, b) => {
      const s0 = base + b * spb;
      const bassRoot = 36 + c.root; // octave 2
      for (const p of bassPat) {
        const off = p.sym === 'O' ? 12 : p.sym === 'F' ? 7 : p.sym === 'T' ? c.tones[1] : 0;
        events.push({ step: s0 + p.i, ch: 'bass', midi: bassRoot + off, len: p.len });
      }
      for (const p of drumPat) events.push({ step: s0 + p.i, ch: 'drum', sym: p.sym });
      const arpRoot = 12 * ((t.inst.arp?.oct ?? 4) + 1) + c.root;
      if (style === 'stab' || style === 'waltz') {
        const hits = style === 'stab' ? [2, 6, 10, 14] : [4, 8];
        for (const h of hits) {
          if (h >= spb) continue;
          for (const tone of c.tones.slice(0, 3)) events.push({ step: s0 + h, ch: 'arp', midi: arpRoot + tone, len: style === 'waltz' ? 2 : 1 });
        }
      } else if (ARP[style]) {
        const seq = ARP[style];
        for (let i = 0; i < spb; i++) events.push({ step: s0 + i, ch: 'arp', midi: arpRoot + c.tones[seq[i % seq.length] % c.tones.length], len: 1 });
      }
    });
    bar0 += bars;
  }
  const total = bar0 * spb;
  const buckets = Array.from({ length: total }, () => []);
  for (const e of events) buckets[e.step].push(e);
  const stepDur = 60 / t.bpm / 4; // every grid step is a 16th note (3/4 bars just have 12)
  return { ...t, total, buckets, stepDur, seconds: total * stepDur };
}

// ── synth ──────────────────────────────────────────────────────────────────
function pulseWave(ctx, duty) {
  const N = 48;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    re[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI);
    im[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI);
  }
  return ctx.createPeriodicWave(re, im);
}

export function makeVoices(ctx, dest, noise) {
  const waves = { p12: pulseWave(ctx, 0.125), p25: pulseWave(ctx, 0.25), p50: pulseWave(ctx, 0.5) };
  const osc = (wave) => {
    const o = ctx.createOscillator();
    if (waves[wave]) o.setPeriodicWave(waves[wave]);
    else o.type = wave || 'triangle';
    return o;
  };
  const note = (t, f, dur, { wave, vol, vib = 0, pluck = false, gate = 0.9 }) => {
    const o = osc(wave);
    const g = ctx.createGain();
    const len = Math.max(0.04, dur * gate);
    const a = 0.005;
    const decayEnd = Math.min(t + a + (pluck ? 0.18 : 0.09), t + len * 0.85);
    const sus = pluck ? 0.18 : 0.62;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * sus), decayEnd);
    g.gain.setValueAtTime(Math.max(0.0002, vol * sus), t + len);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);
    if (vib && len > 0.26) {
      const l = ctx.createOscillator();
      const lg = ctx.createGain();
      l.frequency.value = 5.6;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * vib, t + 0.22);
      l.connect(lg).connect(o.frequency);
      l.start(t);
      l.stop(t + len + 0.08);
    }
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + len + 0.08);
  };
  const hit = (t, { type, freq, q = 0.8, decay, vol }) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 1.2);
    s.stop(t + decay + 0.02);
  };
  const kick = (t, v) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(155, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
    g.gain.setValueAtTime(0.75 * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.18);
  };
  const drum = (t, sym, v) => {
    if (sym === 'k' || sym === 'x') kick(t, v);
    if (sym === 's' || sym === 'S') {
      hit(t, { type: 'bandpass', freq: 1900, q: 0.6, decay: 0.13, vol: 0.42 * v });
      note(t, 190, 0.05, { wave: 'triangle', vol: 0.18 * v, gate: 1 });
    }
    if (sym === 'h' || sym === 'x' || sym === 'S') hit(t, { type: 'highpass', freq: 7600, decay: 0.03, vol: 0.13 * v });
    if (sym === 'o') hit(t, { type: 'highpass', freq: 6400, decay: 0.16, vol: 0.11 * v });
  };
  return { note, drum };
}

export function scheduleStep(voices, track, step, t) {
  const sw = track.swing && step % 2 === 1 ? track.swing * track.stepDur : 0;
  const at = t + sw;
  const inst = track.inst;
  for (const e of track.buckets[step]) {
    if (e.ch === 'drum') {
      if (inst.drums) voices.drum(at, e.sym, inst.drums);
    } else if (e.ch === 'lead') voices.note(at, mtof(e.midi), e.len * track.stepDur, inst.lead);
    else if (e.ch === 'bass') voices.note(at, mtof(e.midi), e.len * track.stepDur, { wave: 'triangle', vol: inst.bass.vol, gate: 0.86 });
    else if (e.ch === 'arp') voices.note(at, mtof(e.midi), e.len * track.stepDur, { wave: inst.arp.wave, vol: inst.arp.vol, gate: 0.55 });
  }
}

// ── player ─────────────────────────────────────────────────────────────────
const LOOKAHEAD = 0.2;
const TICK_MS = 40;
const LEVEL = 0.2; // background: sits under the sound effects

let compiled = null;
let order = [];
let pos = 0;
let step = 0;
let nextT = 0;
let timer = 0;
let bus = null;
let voices = null;
let want = false;
const holds = new Set();
const subs = new Set();

const loadPref = (k, d) => {
  try {
    const v = localStorage.getItem(`rudra.${k}`);
    return v == null ? d : JSON.parse(v);
  } catch {
    return d;
  }
};
const savePref = (k, v) => {
  try {
    localStorage.setItem(`rudra.${k}`, JSON.stringify(v));
  } catch {
    /* blocked */
  }
};

function shuffle(avoidFirst) {
  const a = TRACKS.map((_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (a[0] === avoidFirst && a.length > 1) a.push(a.shift());
  return a;
}

function load(i) {
  compiled = compileTrack(TRACKS[i]);
  step = 0;
  savePref('lastTrack', i);
}

function info() {
  if (!compiled) return null;
  const i = TRACKS.findIndex((t) => t.id === compiled.id);
  return { index: i, number: i + 1, count: TRACKS.length, title: compiled.title, mood: compiled.mood, playing: !!timer };
}
const emit = () => subs.forEach((fn) => fn(info()));

function ensureGraph(ctx) {
  if (bus) return;
  bus = ctx.createGain();
  bus.gain.value = 0.0001;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 10;
  comp.ratio.value = 3;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  bus.connect(comp).connect(ctx.destination);
  voices = makeVoices(ctx, bus, audioNoise());
}

function tick() {
  const ctx = audioContext();
  if (!ctx || !compiled) return;
  while (nextT < ctx.currentTime + LOOKAHEAD) {
    if (step >= compiled.total) {
      pos += 1;
      if (pos >= order.length) {
        order = shuffle(order.at(-1));
        pos = 0;
      }
      load(order.at(pos));
      nextT = Math.max(nextT, ctx.currentTime) + 0.9; // a breath between songs
      emit();
      return;
    }
    scheduleStep(voices, compiled, step, nextT);
    nextT += compiled.stepDur;
    step += 1;
  }
}

function startLoop() {
  const ctx = audioContext();
  if (!ctx || timer) return;
  ensureGraph(ctx);
  if (!order.length) {
    order = shuffle(loadPref('lastTrack', -1));
    pos = 0;
    load(order.at(0));
  }
  nextT = ctx.currentTime + 0.08;
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), ctx.currentTime);
  bus.gain.exponentialRampToValueAtTime(LEVEL, ctx.currentTime + 0.6);
  timer = setInterval(tick, TICK_MS);
  tick();
  emit();
}

function stopLoop() {
  if (!timer) return;
  clearInterval(timer);
  timer = 0;
  const ctx = audioContext();
  if (ctx && bus) {
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
  }
  emit();
}

function sync() {
  if (want && holds.size === 0) startLoop();
  else stopLoop();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) holds.add('hidden');
    else holds.delete('hidden');
    sync();
  });
}

export const music = {
  /** Desired state: true when sound + music are on and audio is unlocked. */
  set(on) {
    want = !!on;
    sync();
  },
  /** Temporarily pause for a reason (e.g. 'game'); resumes when every hold is released. */
  hold(reason) {
    holds.add(reason);
    sync();
  },
  release(reason) {
    holds.delete(reason);
    sync();
  },
  next() {
    const ctx = audioContext();
    if (!ctx) return;
    if (!order.length) order = shuffle(-1);
    pos = (pos + 1) % order.length;
    load(order.at(pos));
    if (timer) {
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setValueAtTime(0.0001, ctx.currentTime);
      bus.gain.exponentialRampToValueAtTime(LEVEL, ctx.currentTime + 0.4);
      nextT = ctx.currentTime + 0.12;
    }
    emit();
  },
  info,
  subscribe(fn) {
    subs.add(fn);
    fn(info());
    return () => subs.delete(fn);
  },
};
