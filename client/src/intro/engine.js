// Runs the intro scene: owns the low-res canvas, the camera path and the render loop.
// Everything that moves is a number on `state`, so a GSAP timeline can drive it.
//
// Three ways to draw it (quality.js decides which, and can switch mid-way):
//  full   · the bedroom at RES.full pixels on the short side
//  light  · the same bedroom at RES.light (about half the pixels)
//  simple · only the TV set, drawn at the picture's own size and scaled up by the browser;
//           the dive into the glass is a CSS zoom of the canvas
// After every frame it reports how long the frame took (onDraw) and catches a frame that
// throws (onError), so a broken frame can never freeze the opening.
import { clearTarget, createTarget, lookAt, pack, project, render } from './raster';
import { buildRoom, SCREEN, TV_LIGHT } from './room';
import { createScreen } from './screen';

const FOV = (50 * Math.PI) / 180;
const TAN = Math.tan(FOV / 2);
const unit = (d) => {
  const l = Math.hypot(...d);
  return d.map((x) => x / l);
};
const MOON = unit([-0.55, 0.62, -0.56]); // cool light from the window, back left
const FILL = unit([0.65, 0.35, 0.7]); // a warm spill from a doorway, front right

// Camera shots. `fit` = [w, h] in cm that must stay in frame, so every aspect ratio
// gets the same composition; tall (portrait) screens can override with their own.
const SHOTS = [
  // standby: the pad up front, the console behind it, the dark TV looming
  { t: [2, 9, 70], d: [0.44, 0.26, 1], fit: [96, 92], tall: { t: [3, 20, 64], d: [0.14, 0.46, 1], fit: [50, 132] } },
  // the whole setup in the TV's light
  { t: [0, 48, 26], d: [0.17, 0.2, 1], fit: [150, 118], tall: { t: [0, 46, 30], d: [0.1, 0.16, 1], fit: [80, 140] } },
  // the TV fills the frame
  { t: [0, 68.5, 6], d: [0, 0.035, 1], fit: [76, 58], tall: { t: [0, 68.5, 6], d: [0, 0.03, 1], fit: [60, 46] } },
  // through the glass
  { eye: [0, 68.5, 7.4], t: [0, 68.5, -40] },
];

function shotCam(i, aspect) {
  let s = SHOTS[i];
  if (s.eye) return { eye: s.eye, t: s.t };
  if (aspect < 0.9 && s.tall) s = s.tall;
  const d = unit(s.d);
  const dist = Math.max(s.fit[1] / 2 / TAN, s.fit[0] / 2 / (TAN * aspect));
  return { eye: s.t.map((v, k) => v + d[k] * dist), t: s.t };
}

const lerp3 = (a, b, f) => a.map((v, k) => v + (b[k] - v) * f);

// picture height in pixels (short side of the screen), [desktop, phone]; simple has its own size
const RES = { full: [270, 240], light: [180, 160], simple: [192, 192] };
// simple's TV set around the 256×192 picture: the case border and the chin under the glass
const TV = { b: 14, chin: 12 };

/** Nearest-neighbour copy of src into T at (x0, y0, w, h), clipped, with optional scanlines and brightness. */
function blit(T, src, x0, y0, w, h, { scan = 0, mul = 1 } = {}) {
  const yA = Math.max(0, y0);
  const yB = Math.min(T.h, y0 + h);
  const xA = Math.max(0, x0);
  const xB = Math.min(T.w, x0 + w);
  if (xB <= xA || yB <= yA) return;
  const sx = src.w / w;
  const sy = src.h / h;
  const out = T.px;
  const inp = src.px;
  for (let y = yA; y < yB; y++) {
    const v = Math.min(src.h - 1, ((y - y0) * sy) | 0);
    const row = v * src.w;
    const k = y & 1 ? mul * (1 - scan) : mul; // scanlines on screen rows, so scaling never bands them
    let i = y * T.w + xA;
    for (let x = xA; x < xB; x++, i++) {
      const p = inp[row + Math.min(src.w - 1, ((x - x0) * sx) | 0)];
      if (k === 1) out[i] = p;
      else out[i] = pack(Math.min(255, (p & 255) * k) | 0, Math.min(255, ((p >> 8) & 255) * k) | 0, Math.min(255, ((p >> 16) & 255) * k) | 0);
    }
  }
}

function fillBox(T, x, y, w, h, c) {
  const x0 = Math.max(0, x);
  const x1 = Math.min(T.w, x + w);
  for (let r = Math.max(0, y); r < Math.min(T.h, y + h); r++) if (x1 > x0) T.px.fill(c, r * T.w + x0, r * T.w + x1);
}

export function createIntro(canvas, { compact = false, logo = 'RUDRA', tier: startTier = 'full', onDraw, onError } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2d canvas unavailable');
  const screen = createScreen(logo);
  // the 3D room is only built when it will be drawn
  let room = startTier === 'simple' ? null : buildRoom(screen.T);
  let tier = startTier;

  const state = {
    shot: 0, // 0 standby → 1 wide → 2 TV → 3 inside (fractional while moving)
    sway: 1,
    startGlow: 1,
    press: 0,
    slider: 0,
    power: 0,
    tvLed: 0,
    mode: 'off', // off · power · emblem · title
    t: 0, // seconds into the current mode
    bright: 1,
    confirm: false,
  };

  const resFor = (t) => (RES[t] || RES.full)[compact ? 1 : 0];
  let short = resFor(tier);
  let T = null;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let clock = 0;
  let shownZoom = 1;

  function resize() {
    if (tier === 'simple' || !room) {
      const w = 256 + TV.b * 2;
      const h = 192 + TV.b * 2 + TV.chin;
      if (!T || T.w !== w || T.h !== h) {
        canvas.width = w;
        canvas.height = h;
        T = createTarget(w, h);
      }
      return;
    }
    const cw = canvas.clientWidth || window.innerWidth;
    const ch = canvas.clientHeight || window.innerHeight;
    const scale = Math.min(cw, ch) / short;
    const w = Math.max(64, Math.round(cw / scale));
    const h = Math.max(48, Math.round(ch / scale));
    if (!T || T.w !== w || T.h !== h) {
      canvas.width = w;
      canvas.height = h;
      T = createTarget(w, h);
    }
  }

  function camera() {
    const aspect = T.w / T.h;
    const s = Math.max(0, Math.min(SHOTS.length - 1, state.shot));
    const i = Math.min(SHOTS.length - 2, Math.floor(s));
    const f = s - i;
    const A = shotCam(i, aspect);
    const B = shotCam(i + 1, aspect);
    const eye = lerp3(A.eye, B.eye, f);
    const tgt = lerp3(A.t, B.t, f);
    const sw = state.sway;
    eye[0] += Math.sin(clock * 0.45) * 1.8 * sw;
    eye[1] += Math.sin(clock * 0.31 + 1) * 1.1 * sw;
    return lookAt(eye, tgt, FOV, aspect, 0.4);
  }

  /**
   * simple: only the TV set, drawn at the picture's own size (1 picture pixel = 1 canvas pixel,
   * so even the smallest title-screen text stays readable) and scaled up by the browser.
   * The dive into the glass is a CSS zoom of the whole canvas: no extra pixels to draw.
   */
  function drawTV() {
    const S = state;
    screen.draw(S.mode, S.t, S);
    const { w: pw, h: ph } = screen.T;
    T.px.fill(pack(38, 38, 42)); // the set's case
    fillBox(T, 0, 0, T.w, 1, pack(70, 70, 76)); // a lit top edge
    fillBox(T, TV.b - 1, TV.b - 1, pw + 2, ph + 2, pack(12, 12, 14)); // the glass sits in a recess
    const dive = Math.max(0, Math.min(1, S.shot - 2));
    blit(T, screen.T, TV.b, TV.b, pw, ph, { scan: 0.1 + dive * 0.22, mul: S.mode === 'off' ? 1 : S.bright });
    const ledCol = S.tvLed ? pack(64, 176, 96) : pack(150, 34, 28);
    fillBox(T, T.w - TV.b - 8, T.h - Math.round(TV.chin * 0.75) - 2, 4, 3, ledCol);
    const zoom = 1 + dive * dive * 5;
    if (zoom !== shownZoom) {
      shownZoom = zoom;
      if (zoom > 1.0001) {
        // zoom around the middle of the glass: the set is letterboxed inside the canvas box (object-fit)
        const bw = canvas.clientWidth || T.w;
        const bh = canvas.clientHeight || T.h;
        const k = Math.min(bw / T.w, bh / T.h);
        const oy = (bh - T.h * k) / 2 + (TV.b + ph / 2) * k;
        canvas.style.transformOrigin = `50% ${oy.toFixed(1)}px`;
        canvas.style.transform = `scale(${zoom.toFixed(4)})`;
      } else canvas.style.transform = '';
    }
  }

  function draw() {
    const t0 = performance.now();
    resize();
    if (tier === 'simple' || !room) {
      drawTV();
      ctx.putImageData(T.img, 0, 0);
      onDraw?.(performance.now() - t0);
      return;
    }
    const S = state;
    const pulse = 0.5 + 0.5 * Math.sin(clock * 4.2);
    const g = S.startGlow * (0.3 + 0.7 * pulse);
    room.startMat.emit = [233 * g, 178 * g, 80 * g];
    room.conLed.emit = S.power ? [70, 205, 112] : [150 * (0.55 + 0.45 * Math.sin(clock * 1.7)), 34, 28];
    room.tvLed.emit = S.tvLed ? [64, 176, 96] : [118, 30, 26];
    room.slider.off[0] = S.slider * 5;
    room.start.off[1] = -0.22 * S.press;

    screen.draw(S.mode, S.t, S);
    const avg = screen.average();
    const cam = camera();

    // sample a smaller copy of the picture while the TV is small on screen (no shimmer)
    const top = project(T, cam, 0, SCREEN.y1, SCREEN.z);
    const bot = project(T, cam, 0, SCREEN.y0, SCREEN.z);
    const hpx = top && bot ? Math.abs(bot[1] - top[1]) : T.h * 4;
    room.screen.tex = hpx < 64 ? screen.mip(2) : hpx < 128 ? screen.mip(1) : screen.T;
    room.screen.texMul = S.bright;

    const on = S.mode === 'off' ? 0 : S.bright * 1.25;
    const L = {
      amb: [0.17, 0.17, 0.21],
      dir: MOON,
      dcol: [0.34, 0.4, 0.56],
      dir2: FILL,
      dcol2: [0.17, 0.12, 0.085],
      pt: TV_LIGHT,
      pcol: [avg[0] * on, avg[1] * on, avg[2] * on],
      prange: 95,
      fog: [5, 6, 8],
      fogNear: 230,
      fogFar: 580,
    };
    clearTarget(T, 5, 6, 8);
    const scan = Math.max(0, Math.min(1, (S.shot - 2.2) / 0.5)) * 0.32;
    render(T, room.meshes, cam, L, { scan });
    ctx.putImageData(T.img, 0, 0);
    onDraw?.(performance.now() - t0);
  }

  /** One frame, never letting an exception out of the loop. */
  function safeDraw() {
    try {
      draw();
    } catch (err) {
      onError?.(err);
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    clock += dt;
    acc += dt;
    if (acc < 1 / 30 - 0.004) return; // 30 fps, like the real thing
    acc = 0;
    safeDraw();
  }

  return {
    state,
    start() {
      if (raf) return;
      last = performance.now();
      safeDraw();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    draw: safeDraw,
    setHost: screen.setHost,
    /** Switch how the scene is drawn: 'full' · 'light' · 'simple'. Takes effect on the next frame. */
    setTier(next) {
      if (!RES[next] || next === tier) return;
      tier = next;
      short = resFor(next);
      if (next !== 'simple' && !room) room = buildRoom(screen.T);
    },
    get tier() {
      return tier;
    },
    /** Current picture size in pixels, e.g. "480×270". */
    get res() {
      return T ? `${T.w}×${T.h}` : '';
    },
    dispose() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
