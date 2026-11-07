// What the TV shows, drawn into a 256×192 buffer that becomes the screen's texture:
//  off    · dark glass with a faint reflection
//  power  · the CRT warming up: a dot, a line, then the whole tube floods white
//  emblem · the RNM-16 boot logo: a voxel "R" flies in and lands, with a glint
//  title  · the game's title screen (RUDRA · PRESS START)
import { box, clearTarget, createTarget, lookAt, mat, mesh, pack, render } from './raster';
import { GLYPH_H, glyph, measureText } from '../lib/pixelfont';

const W = 256;
const H = 192;
const ACCENT = [233, 178, 80];
const INK = [242, 238, 230];
const MUTED = [140, 137, 129];

const ease3 = (k) => 1 - (1 - k) ** 3;
const clamp01 = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);

function fillRect(T, x, y, w, h, c) {
  const x0 = Math.max(0, Math.round(x));
  const x1 = Math.min(T.w, Math.round(x + w));
  const y0 = Math.max(0, Math.round(y));
  const y1 = Math.min(T.h, Math.round(y + h));
  if (x1 <= x0) return;
  for (let r = y0; r < y1; r++) T.px.fill(c, r * T.w + x0, r * T.w + x1);
}

/** Pixel-font text straight into the buffer. `rows` limits how many glyph rows show (for wipes). */
function text(T, str, cx, y, { scale = 1, tall = 1, color = INK, count = Infinity, rows = GLYPH_H } = {}) {
  const s = String(str).toUpperCase();
  const w = measureText(s) * scale;
  let x = Math.round(cx - w / 2);
  const ph = Math.max(1, Math.round(scale * tall));
  const c = pack(color[0], color[1], color[2]);
  let n = 0;
  for (const ch of s) {
    if (n >= count) break;
    n += 1;
    const g = glyph(ch);
    const gw = g[0].length;
    for (let r = 0; r < Math.min(rows, GLYPH_H); r++) {
      for (let k = 0; k < gw; k++) if (g[r][k] === '#') fillRect(T, x + k * scale, y + r * ph, scale, ph, c);
    }
    x += (gw + 1) * scale;
  }
}

/** A static background painted once by a per-pixel function. */
function paint(fn) {
  const out = new Uint32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b] = fn(x, y, (x - W / 2) / (W / 2), (y - H / 2) / (H / 2));
      out[y * W + x] = pack(r | 0, g | 0, b | 0);
    }
  }
  return out;
}

function buildR() {
  const m = mesh();
  const g = glyph('R');
  const amber = mat([233, 178, 80]);
  for (let row = 0; row < GLYPH_H; row++) {
    for (let col = 0; col < g[0].length; col++) {
      if (g[row][col] !== '#') continue;
      const x0 = col - 2.5 + 0.04;
      const y1 = (3.5 - row) * 1.3;
      box(m, x0, x0 + 0.92, y1 - 1.22, y1, -0.6, 0.6, amber, { skip: [] });
    }
  }
  return m;
}

export function createScreen(logo = 'RUDRA') {
  const T = createTarget(W, H);
  const mips = [T, createTarget(W / 2, H / 2), createTarget(W / 4, H / 4)];
  let host = '';

  const OFF = paint((x, y, u, v) => {
    const glow = Math.max(0, 1 - (u * u + v * v)) * 7;
    const refl = x + y * 0.55 > 34 && x + y * 0.55 < 62 && y < 92 ? 7 : 0;
    return [9 + glow + refl, 11 + glow + refl, 13 + glow + refl * 1.3];
  });
  const PAPER = paint((x, y, u, v) => {
    const k = 1 - 0.13 * (u * u + v * v);
    return [236 * k, 231 * k, 220 * k];
  });
  const NIGHT = paint((x, y, u, v) => {
    const k = Math.max(0, 1 - (u * u + v * v)) * 6;
    return [5 + k, 5 + k, 6 + k];
  });

  // the voxel R and its little stage
  const R0 = buildR();
  const R = { v: R0.v.slice(), f: R0.f.map((f) => ({ ...f })), off: [0, 0, 0], show: true };
  const RL = { amb: [0.46, 0.43, 0.4], dir: [-0.42, 0.62, 0.66], dcol: [0.72, 0.68, 0.6], pt: [0, 0, 0], pcol: null, prange: 1 };
  const spinR = (ry, rx) => {
    const cy = Math.cos(ry);
    const sy = Math.sin(ry);
    const cx = Math.cos(rx);
    const sx = Math.sin(rx);
    const rot = (x, y, z) => {
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      return [x1, y * cx - z1 * sx, y * sx + z1 * cx];
    };
    for (let i = 0; i < R0.v.length; i += 3) {
      const p = rot(R0.v[i], R0.v[i + 1], R0.v[i + 2]);
      R.v[i] = p[0];
      R.v[i + 1] = p[1];
      R.v[i + 2] = p[2];
    }
    R0.f.forEach((f, k) => {
      R.f[k].n = rot(f.n[0], f.n[1], f.n[2]);
    });
  };

  function emblem(t) {
    T.px.set(PAPER);
    T.depth.fill(0);
    const LAND = 1.15;
    const e = ease3(clamp01(t / LAND));
    spinR((1 - e) * Math.PI * 3, (1 - e) * 0.7);
    R.off[2] = -95 * (1 - e);
    const cam = lookAt([0, -2.4, 34], [0, -2.4, 0], (36 * Math.PI) / 180, W / H, 0.5);
    render(T, [R], cam, RL);
    // glint across the landed R
    const g = (t - LAND - 0.05) / 0.5;
    if (g > 0 && g < 1) {
      const xb = -60 + g * 360;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (!T.depth[i]) continue;
          const d = x + y * 0.6 - xb;
          if (d < 0 || d > 20) continue;
          const p = T.px[i];
          const r = Math.min(248, (p & 255) + 70);
          const gg = Math.min(248, ((p >> 8) & 255) + 70);
          const b = Math.min(248, ((p >> 16) & 255) + 70);
          T.px[i] = pack(r, gg, b);
        }
      }
    }
    if (t > 1.2) text(T, 'RNM-16', W / 2, 124, { scale: 2, color: [44, 41, 37], count: Math.floor((t - 1.2) / 0.045) + 1 });
    if (t > 1.5) text(T, 'ENTERTAINMENT SYSTEM', W / 2, 148, { color: [122, 117, 108], count: Math.floor((t - 1.5) / 0.025) + 1 });
  }

  function power(p) {
    clearTarget(T, 0, 0, 0);
    const white = pack(250, 250, 255);
    if (p < 0.28) {
      const k = ease3(p / 0.28);
      const w = Math.max(2, k * W);
      fillRect(T, (W - w) / 2, H / 2 - 4, w, 8, pack(40, 44, 60));
      fillRect(T, (W - w) / 2, H / 2 - 1, w, 2, white);
    } else if (p < 0.62) {
      const k = (p - 0.28) / 0.34;
      const h = 2 + k * k * (H - 2);
      fillRect(T, 0, (H - h) / 2, W, h, pack(232, 236, 248));
      fillRect(T, 0, (H - h) / 2, W, 2, white);
      fillRect(T, 0, (H + h) / 2 - 2, W, 2, white);
    } else {
      const k = (p - 0.62) / 0.38;
      for (let i = 0; i < T.px.length; i++) {
        const q = PAPER[i];
        const r = q & 255;
        const g = (q >> 8) & 255;
        const b = (q >> 16) & 255;
        T.px[i] = pack(r + (255 - r) * (1 - k), g + (255 - g) * (1 - k), b + (255 - b) * (1 - k));
      }
    }
    // a little static while the tube settles
    if (p > 0.18 && p < 0.78) {
      for (let n = 0; n < 7; n++) {
        const y = (Math.random() * H) | 0;
        const c = 120 + ((Math.random() * 120) | 0);
        fillRect(T, 0, y, W, 1, pack(c, c, c + 8));
      }
    }
  }

  function title(t, confirm) {
    T.px.set(NIGHT);
    // logotype wipes in row by row, flashes once, settles
    const rows = Math.min(GLYPH_H, Math.floor(t / 0.035));
    const flash = t > 0.26 && t < 0.34;
    if (rows > 0) text(T, logo, W / 2, 22, { scale: 5, tall: 1.6, color: flash ? [255, 255, 255] : INK, rows });
    if (t > 0.34) text(T, 'SOFTWARE ENGINEER', W / 2, 88, { color: MUTED, count: Math.floor((t - 0.34) / 0.02) + 1 });
    if (t > 0.62) {
      const on = confirm ? Math.floor(t * 16) % 2 === 0 : Math.floor((t - 0.62) * 2.4) % 2 === 0;
      if (on) text(T, 'PRESS START', W / 2, 124, { scale: 2, color: ACCENT });
      text(T, host ? `SERVED FROM ${host}` : '(C) 2026 RUDRA NARAYAN MONDAL', W / 2, 170, { color: [86, 84, 80] });
    }
  }

  function draw(mode, t, S) {
    if (mode === 'off') T.px.set(OFF);
    else if (mode === 'power') power(clamp01(t));
    else if (mode === 'emblem') emblem(t);
    else if (mode === 'title') title(t, S.confirm);
    mips[1].fresh = false;
    mips[2].fresh = false;
  }

  /** Box-filtered half and quarter copies, so the picture holds together when the TV is small. */
  function mip(level) {
    for (let l = 1; l <= level; l++) {
      const dst = mips[l];
      if (dst.fresh) continue;
      const src = mips[l - 1];
      for (let y = 0; y < dst.h; y++) {
        for (let x = 0; x < dst.w; x++) {
          const i = y * 2 * src.w + x * 2;
          const a = src.px[i];
          const b = src.px[i + 1];
          const c = src.px[i + src.w];
          const d = src.px[i + src.w + 1];
          const r = ((a & 255) + (b & 255) + (c & 255) + (d & 255)) >> 2;
          const g = (((a >> 8) & 255) + ((b >> 8) & 255) + ((c >> 8) & 255) + ((d >> 8) & 255)) >> 2;
          const bl = (((a >> 16) & 255) + ((b >> 16) & 255) + ((c >> 16) & 255) + ((d >> 16) & 255)) >> 2;
          dst.px[y * dst.w + x] = pack(r, g, bl);
        }
      }
      dst.fresh = true;
    }
    return mips[level];
  }

  /** Mean colour of the picture (0…1), which is what lights the room. */
  function average() {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = 4; y < H; y += 8) {
      for (let x = 4; x < W; x += 8) {
        const p = T.px[y * W + x];
        r += p & 255;
        g += (p >> 8) & 255;
        b += (p >> 16) & 255;
        n += 1;
      }
    }
    return [r / n / 255, g / n / 255, b / n / 255];
  }

  return {
    T,
    draw,
    mip,
    average,
    setHost(label) {
      host = label ? String(label).toUpperCase().slice(0, 30) : '';
    },
  };
}
