// The bedroom the intro starts in: a CRT TV on a low wooden stand, an original
// grey "RNM-16" console on the carpet and its controller, cable and all.
// Units are centimetres, y is up, the TV faces +z (towards the camera).
import { box, cylinder, mat, mesh, place, quad } from './raster';

export const SCREEN = { x0: -26, x1: 26, y0: 49, y1: 88, z: 5, bulge: 1.6 };
export const SCREEN_CENTER = [0, (SCREEN.y0 + SCREEN.y1) / 2, SCREEN.z + SCREEN.bulge];
export const TV_LIGHT = [0, 68, 28];

function grid(m, x0, x1, z0, z1, y, nx, nz, material) {
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = x0 + ((x1 - x0) * i) / nx;
      const b = x0 + ((x1 - x0) * (i + 1)) / nx;
      const c = z0 + ((z1 - z0) * j) / nz;
      const d = z0 + ((z1 - z0) * (j + 1)) / nz;
      quad(m, [a, y, c], [b, y, c], [b, y, d], [a, y, d], material, { n: [0, 1, 0] });
    }
  }
}

function wall(m, x0, x1, y0, y1, z, nx, ny, material) {
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const a = x0 + ((x1 - x0) * i) / nx;
      const b = x0 + ((x1 - x0) * (i + 1)) / nx;
      const c = y0 + ((y1 - y0) * j) / ny;
      const d = y0 + ((y1 - y0) * (j + 1)) / ny;
      quad(m, [a, c, z], [b, c, z], [b, d, z], [a, d, z], material, { n: [0, 0, 1] });
    }
  }
}

/** Flat strip along a polyline (the controller cable lying on the carpet). */
function ribbon(m, pts, width, material) {
  const sides = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0];
    let dz = b[2] - a[2];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const w = width / 2;
    return [
      [p[0] - dz * w, p[1], p[2] + dx * w],
      [p[0] + dz * w, p[1], p[2] - dx * w],
    ];
  });
  for (let i = 0; i < sides.length - 1; i++) {
    quad(m, sides[i][0], sides[i][1], sides[i + 1][1], sides[i + 1][0], material, { n: [0, 1, 0] });
  }
}

function catmull(points, steps) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(
        [0, 1, 2].map(
          (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3),
        ),
      );
    }
  }
  out.push(points.at(-1));
  return out;
}

export function buildRoom(screenTex) {
  const meshes = [];
  const add = (m) => (meshes.push(m), m);

  // ── room ──
  const room = add(mesh());
  grid(room, -280, 280, -90, 300, 0, 16, 12, mat('#262220'));
  grid(room, -62, 74, 18, 132, 0.2, 6, 6, mat('#3a2b2d', { bias: 1.006 }));
  wall(room, -280, 280, 0, 240, -90, 10, 4, mat('#1b1a21'));
  // window (moonlight) and a poster
  const glass = mat([0, 0, 0], { emit: [44, 62, 92], bias: 1.008 });
  const frame = mat('#0f0f14', { bias: 1.004 });
  quad(room, [-172, 92, -89.5], [-98, 92, -89.5], [-98, 188, -89.5], [-172, 188, -89.5], frame, { n: [0, 0, 1] });
  for (const [x0, x1] of [
    [-168, -137],
    [-133, -102],
  ]) {
    for (const [y0, y1] of [
      [96, 138],
      [142, 184],
    ]) {
      quad(room, [x0, y0, -89.2], [x1, y0, -89.2], [x1, y1, -89.2], [x0, y1, -89.2], glass, { n: [0, 0, 1] });
    }
  }
  quad(room, [92, 104, -89.5], [150, 104, -89.5], [150, 182, -89.5], [92, 182, -89.5], mat('#2e4447', { bias: 1.004 }), { n: [0, 0, 1] });
  quad(room, [100, 140, -89.3], [142, 140, -89.3], [142, 174, -89.3], [100, 174, -89.3], mat('#b8873e', { bias: 1.008 }), { n: [0, 0, 1] });
  quad(room, [100, 112, -89.3], [142, 112, -89.3], [142, 118, -89.3], [100, 118, -89.3], mat('#d9cfbd', { bias: 1.008 }), { n: [0, 0, 1] });

  // ── TV stand ──
  const stand = add(mesh());
  box(stand, -50, 50, 0, 40, -40, 12, { top: mat('#5c473a'), side: mat('#4a392e'), front: mat('#45352a') }, { skip: ['bottom', 'back'] });
  box(stand, -0.7, 0.7, 4, 37, 12, 12.3, mat('#2a201a', { bias: 1.004 }), { skip: ['bottom', 'back'] });
  box(stand, -5, -3, 19, 22, 12, 13.2, mat('#9a8564'), { skip: ['bottom', 'back'] });
  box(stand, 3, 5, 19, 22, 12, 13.2, mat('#9a8564'), { skip: ['bottom', 'back'] });

  // ── CRT TV ──
  const tv = add(mesh());
  const body = mat('#2b2b2f');
  const front = mat('#36363b');
  const bez = { front, side: body, top: body, bottom: body };
  box(tv, -34, 34, 88, 92, -14, 8, bez, { skip: ['back'] });
  box(tv, -34, 34, 40, 49, -14, 8, bez, { skip: ['back', 'bottom'] });
  box(tv, -34, -26, 49, 88, -14, 8, bez, { skip: ['back', 'top', 'bottom'] });
  box(tv, 26, 34, 49, 88, -14, 8, bez, { skip: ['back', 'top', 'bottom'] });
  // tapered tube housing
  const back = mat('#252528');
  const c = [0, 66, -29];
  const F = { x0: -34, x1: 34, y0: 40, y1: 92, z: -14 };
  const B = { x0: -22, x1: 22, y0: 48, y1: 86, z: -44 };
  quad(tv, [F.x0, F.y1, F.z], [F.x1, F.y1, F.z], [B.x1, B.y1, B.z], [B.x0, B.y1, B.z], back, { center: c });
  quad(tv, [F.x0, F.y0, F.z], [F.x0, F.y1, F.z], [B.x0, B.y1, B.z], [B.x0, B.y0, B.z], back, { center: c });
  quad(tv, [F.x1, F.y0, F.z], [F.x1, F.y1, F.z], [B.x1, B.y1, B.z], [B.x1, B.y0, B.z], back, { center: c });
  quad(tv, [B.x0, B.y0, B.z], [B.x1, B.y0, B.z], [B.x1, B.y1, B.z], [B.x0, B.y1, B.z], back, { center: c });
  // speaker grille, buttons, power light
  const grille = mat('#1b1b1e', { bias: 1.004 });
  for (let i = 0; i < 4; i++) box(tv, -31, -15, 41.4 + i * 1.7, 42.3 + i * 1.7, 8, 8.15, grille, { skip: ['bottom', 'back'] });
  const btn = mat('#1f1f23', { bias: 1.004 });
  for (const x of [13.5, 17, 20.5]) box(tv, x, x + 1.8, 42.4, 44.8, 8, 8.5, btn, { skip: ['bottom', 'back'] });
  const tvLed = mat([0, 0, 0], { emit: [120, 30, 26], bias: 1.004 });
  box(tv, 27, 29, 43, 44.4, 8, 8.4, tvLed, { skip: ['bottom', 'back'] });

  // the glass: a gently bulged grid, textured with whatever the TV is showing
  const screen = add(mesh());
  const scr = mat([0, 0, 0], { tex: screenTex, texMul: 1, litMul: 0.12 });
  const S = SCREEN;
  const NX = 8;
  const NY = 6;
  const zAt = (x, y) => {
    const u = x / ((S.x1 - S.x0) / 2);
    const v = (y - (S.y0 + S.y1) / 2) / ((S.y1 - S.y0) / 2);
    return S.z + S.bulge * (1 - u * u) * (1 - v * v);
  };
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NY; j++) {
      const xa = S.x0 + ((S.x1 - S.x0) * i) / NX;
      const xb = S.x0 + ((S.x1 - S.x0) * (i + 1)) / NX;
      const ya = S.y0 + ((S.y1 - S.y0) * j) / NY;
      const yb = S.y0 + ((S.y1 - S.y0) * (j + 1)) / NY;
      const uv = (x, y) => [(x - S.x0) / (S.x1 - S.x0), (S.y1 - y) / (S.y1 - S.y0)];
      quad(screen, [xa, ya, zAt(xa, ya)], [xb, ya, zAt(xb, ya)], [xb, yb, zAt(xb, yb)], [xa, yb, zAt(xa, yb)], scr, {
        n: [0, 0, 1],
        uv: [uv(xa, ya), uv(xb, ya), uv(xb, yb), uv(xa, yb)],
      });
    }
  }

  // ── RNM-16 console ──
  const con = add(mesh());
  const shell = mat('#aaa59c');
  const shellTop = mat('#b7b2a8');
  box(con, -17, 17, 0, 7, 26, 50, { top: shellTop, side: shell, front: mat('#a29d94') });
  box(con, -16, 16, 7, 7.7, 27, 49, { top: mat('#bdb8ae'), side: shell });
  box(con, -17.01, 17.01, 5.1, 5.5, 26, 50.05, mat('#77736c', { bias: 1.006 }), { skip: ['bottom', 'back', 'top'] });
  cylinder(con, -4.5, 38, 8.6, 7.7, 7.95, 16, mat('#6f6b64'));
  cylinder(con, -4.5, 38, 7.9, 7.7, 8.6, 16, { top: mat('#c4bfb5'), side: mat('#a8a39a') });
  cylinder(con, -4.5, 38, 1.6, 8.6, 8.75, 8, mat('#8e8981'));
  box(con, 7.6, 15.6, 7.7, 7.8, 29.8, 32.6, mat('#2a2927', { bias: 1.006 }));
  box(con, 9.5, 12, 7.7, 8.2, 35, 37.2, mat('#8f8a82'));
  box(con, -12.5, -7, 1.6, 4.4, 50, 50.25, mat('#232220', { bias: 1.006 }), { skip: ['bottom', 'back'] });
  box(con, -5, 0.5, 1.6, 4.4, 50, 50.25, mat('#232220', { bias: 1.006 }), { skip: ['bottom', 'back'] });
  const conLed = mat([0, 0, 0], { emit: [140, 34, 28], bias: 1.006 });
  box(con, 11, 12.8, 2.6, 3.8, 50, 50.3, conLed, { skip: ['bottom', 'back'] });
  const slider = add(mesh());
  box(slider, 8, 10.4, 7.7, 8.7, 30.2, 32.2, { top: mat('#9d988f'), side: mat('#7f7a72') });

  // ── controller (built facing +z, then turned towards the camera) ──
  const YAW = 0.3;
  const AT = [8, 0, 86];
  const pad = mesh();
  const padBody = mat('#a8a39a');
  const padTop = mat('#b4afa5');
  box(pad, -6, 6, 0.6, 3, -3, 2.2, { top: padTop, side: padBody });
  box(pad, -8.3, -3.6, 0.3, 2.7, -2.2, 6.2, { top: padTop, side: padBody });
  box(pad, 3.6, 8.3, 0.3, 2.7, -2.2, 6.2, { top: padTop, side: padBody });
  const dark = mat('#3a3937');
  box(pad, -6.7, -3.5, 3, 3.45, -0.5, 0.5, dark);
  box(pad, -5.6, -4.6, 3, 3.45, -1.6, 1.6, dark);
  for (const [x, z] of [
    [5, -1.15],
    [3.85, 0],
    [6.15, 0],
    [5, 1.15],
  ]) {
    cylinder(pad, x, z, 0.55, 3, 3.5, 6, mat('#43413e'));
  }
  box(pad, -1.7, -0.4, 3, 3.22, 0.2, 0.8, mat('#55534f'));
  box(pad, -5.6, -2.4, 1.4, 2.6, -3.5, -3, dark, { skip: ['bottom'] });
  box(pad, 2.4, 5.6, 1.4, 2.6, -3.5, -3, dark, { skip: ['bottom'] });
  add(place(pad, YAW, ...AT));
  const startMat = mat('#55534f', { emit: [0, 0, 0] });
  const start = mesh();
  box(start, 0.4, 1.7, 3, 3.25, 0.2, 0.8, startMat);
  add(place(start, YAW, ...AT));

  // cable from the pad's back edge to port 1 on the console
  const cable = add(mesh());
  const from = [Math.sin(YAW) * -3.4 + AT[0], 1.2, Math.cos(YAW) * -3.4 + AT[2]];
  const pts = catmull(
    [from, [3, 0.45, 76], [-11, 0.45, 70], [-17, 0.45, 61], [-11, 0.45, 53.5], [-9.7, 2.6, 50.4]],
    5,
  );
  ribbon(cable, pts, 0.9, mat('#1f1f21', { two: true, bias: 1.015 }));

  return { meshes, screen: scr, tvLed, conLed, startMat, slider, start };
}
