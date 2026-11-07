// Runs the intro scene: owns the low-res canvas, the camera path and the render loop.
// Everything that moves is a number on `state`, so a GSAP timeline can drive it.
import { clearTarget, createTarget, lookAt, project, render } from './raster';
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

export function createIntro(canvas, { compact = false, logo = 'RUDRA' } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2d canvas unavailable');
  const screen = createScreen(logo);
  const room = buildRoom(screen.T);

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

  let short = compact ? 240 : 270;
  let T = null;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let clock = 0;
  let slowFrames = 0;
  let frames = 0;
  let cost = 0;

  function resize() {
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

  function draw() {
    const t0 = performance.now();
    resize();
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

    // if this device struggles, drop to a coarser picture once
    frames += 1;
    cost += performance.now() - t0;
    if (frames === 12) {
      if (cost / frames > 26 && short > 180) {
        short = Math.round(short * 0.78);
        slowFrames += 1;
      }
      frames = 0;
      cost = 0;
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
    draw();
  }

  return {
    state,
    start() {
      if (raf) return;
      last = performance.now();
      draw();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    draw,
    setHost: screen.setHost,
    get downgraded() {
      return slowFrames > 0;
    },
    dispose() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
