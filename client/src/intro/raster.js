// A tiny PS1-flavoured software renderer, drawn into a low-res pixel buffer:
//  · vertices snap to whole pixels, so polygons "wobble" as the camera moves
//  · Gouraud lighting (per-vertex colour, interpolated across each face)
//  · affine texture mapping (no perspective correction, like the real thing)
//  · per-vertex depth fog
//  · 15-bit colour with the console's 4×4 ordered dither
// Pure JS into an ImageData; no WebGL needed.

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 2 - 4);

export function createTarget(w, h) {
  const img = new ImageData(w, h);
  return { w, h, img, px: new Uint32Array(img.data.buffer), depth: new Float32Array(w * h) };
}

export const pack = (r, g, b) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;

export function clearTarget(T, r, g, b) {
  T.px.fill(pack(r, g, b));
  T.depth.fill(0);
}

/** Camera basis + projection constants. fovY in radians. */
export function lookAt(eye, target, fovY, aspect, near = 0.5) {
  let fx = target[0] - eye[0];
  let fy = target[1] - eye[1];
  let fz = target[2] - eye[2];
  let l = Math.hypot(fx, fy, fz) || 1;
  fx /= l;
  fy /= l;
  fz /= l;
  let rx = -fz;
  let rz = fx;
  l = Math.hypot(rx, rz) || 1;
  rx /= l;
  rz /= l;
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  return { ex: eye[0], ey: eye[1], ez: eye[2], rx, rz, ux, uy, uz, fx, fy, fz, k: 1 / Math.tan(fovY / 2), aspect, near };
}

/** Project a world point → [sx, sy, depth] in target pixels (or null if behind the camera). */
export function project(T, cam, x, y, z) {
  const dx = x - cam.ex;
  const dy = y - cam.ey;
  const dz = z - cam.ez;
  const vz = dx * cam.fx + dy * cam.fy + dz * cam.fz;
  if (vz < cam.near) return null;
  const vx = dx * cam.rx + dz * cam.rz;
  const vy = dx * cam.ux + dy * cam.uy + dz * cam.uz;
  return [T.w / 2 + ((vx * cam.k) / cam.aspect / vz) * (T.w / 2), T.h / 2 - ((vy * cam.k) / vz) * (T.h / 2), vz];
}

// ── raster ────────────────────────────────────────────────────────────────
function tri(T, A, B, C, tex, texMul, litMul, scan, bias) {
  let x0 = A.sx;
  let y0 = A.sy;
  let x1 = B.sx;
  let y1 = B.sy;
  let x2 = C.sx;
  let y2 = C.sy;
  let area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (area === 0) return;
  if (area < 0) {
    const t = B;
    B = C;
    C = t;
    x1 = B.sx;
    y1 = B.sy;
    x2 = C.sx;
    y2 = C.sy;
    area = -area;
  }
  const W = T.w;
  const minX = Math.max(0, Math.min(x0, x1, x2));
  const maxX = Math.min(W - 1, Math.max(x0, x1, x2) - 1);
  const minY = Math.max(0, Math.min(y0, y1, y2));
  const maxY = Math.min(T.h - 1, Math.max(y0, y1, y2) - 1);
  if (minX > maxX || minY > maxY) return;

  const A0 = y1 - y2;
  const B0 = x2 - x1;
  const A1 = y2 - y0;
  const B1 = x0 - x2;
  const A2 = y0 - y1;
  const B2 = x1 - x0;
  const inv = 1 / area;
  const px32 = T.px;
  const depth = T.depth;
  const az = A.iz;
  const bz = B.iz;
  const cz = C.iz;
  const ar = A.r;
  const ag = A.g;
  const ab = A.b;
  const br = B.r;
  const bg = B.g;
  const bb = B.b;
  const cr = C.r;
  const cg = C.g;
  const cb = C.b;
  const tw = tex ? tex.w : 0;
  const th = tex ? tex.h : 0;
  const td = tex ? tex.px : null;

  for (let py = minY; py <= maxY; py++) {
    const cy = py + 0.5;
    const cx = minX + 0.5;
    let w0 = A0 * (cx - x1) + B0 * (cy - y1);
    let w1 = A1 * (cx - x2) + B1 * (cy - y2);
    let w2 = A2 * (cx - x0) + B2 * (cy - y0);
    let i = py * W + minX;
    const drow = (py & 3) << 2;
    for (let px = minX; px <= maxX; px++, i++, w0 += A0, w1 += A1, w2 += A2) {
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const l0 = w0 * inv;
      const l1 = w1 * inv;
      const l2 = 1 - l0 - l1;
      const iz = (l0 * az + l1 * bz + l2 * cz) * bias;
      if (iz <= depth[i]) continue;
      depth[i] = iz;
      let r = l0 * ar + l1 * br + l2 * cr;
      let g = l0 * ag + l1 * bg + l2 * cg;
      let b = l0 * ab + l1 * bb + l2 * cb;
      if (td) {
        let tx = ((l0 * A.u + l1 * B.u + l2 * C.u) * tw) | 0;
        let ty = ((l0 * A.v + l1 * B.v + l2 * C.v) * th) | 0;
        if (tx < 0) tx = 0;
        else if (tx >= tw) tx = tw - 1;
        if (ty < 0) ty = 0;
        else if (ty >= th) ty = th - 1;
        const t = td[ty * tw + tx];
        const m = ty & 1 ? texMul * (1 - scan) : texMul;
        r = (t & 255) * m + r * litMul;
        g = ((t >> 8) & 255) * m + g * litMul;
        b = ((t >> 16) & 255) * m + b * litMul;
      }
      const d = BAYER4[drow | (px & 3)];
      r += d;
      g += d;
      b += d;
      const R = r <= 0 ? 0 : r >= 255 ? 248 : r & 0xf8;
      const G = g <= 0 ? 0 : g >= 255 ? 248 : g & 0xf8;
      const Bc = b <= 0 ? 0 : b >= 255 ? 248 : b & 0xf8;
      px32[i] = 0xff000000 | (Bc << 16) | (G << 8) | R;
    }
  }
}

function clipNear(poly, near) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i];
    const B = poly[(i + 1) % poly.length];
    const ain = A.z >= near;
    const bin = B.z >= near;
    if (ain) out.push(A);
    if (ain !== bin) {
      const t = (near - A.z) / (B.z - A.z);
      out.push({
        x: A.x + (B.x - A.x) * t,
        y: A.y + (B.y - A.y) * t,
        z: near,
        r: A.r + (B.r - A.r) * t,
        g: A.g + (B.g - A.g) * t,
        b: A.b + (B.b - A.b) * t,
        u: A.u + (B.u - A.u) * t,
        v: A.v + (B.v - A.v) * t,
      });
    }
  }
  return out;
}

/**
 * Light one corner. L = { amb, dir, dcol, pt, pcol, prange, fog, fogNear, fogFar } (colours 0…1,
 * fog colour 0…255). Returns [r, g, b] in 0…255.
 */
function shade(mat, n, wx, wy, wz, vz, L, textured) {
  let lr = L.amb[0];
  let lg = L.amb[1];
  let lb = L.amb[2];
  const nd = n[0] * L.dir[0] + n[1] * L.dir[1] + n[2] * L.dir[2];
  if (nd > 0) {
    lr += L.dcol[0] * nd;
    lg += L.dcol[1] * nd;
    lb += L.dcol[2] * nd;
  }
  if (L.dir2) {
    const n2 = n[0] * L.dir2[0] + n[1] * L.dir2[1] + n[2] * L.dir2[2];
    if (n2 > 0) {
      lr += L.dcol2[0] * n2;
      lg += L.dcol2[1] * n2;
      lb += L.dcol2[2] * n2;
    }
  }
  const pc = L.pcol;
  if (pc && (pc[0] > 0.002 || pc[1] > 0.002 || pc[2] > 0.002)) {
    const dx = L.pt[0] - wx;
    const dy = L.pt[1] - wy;
    const dz = L.pt[2] - wz;
    const d2 = dx * dx + dy * dy + dz * dz;
    const dl = Math.sqrt(d2) || 1;
    const np = (n[0] * dx + n[1] * dy + n[2] * dz) / dl;
    if (np > 0) {
      const att = np / (1 + d2 / (L.prange * L.prange));
      lr += pc[0] * att;
      lg += pc[1] * att;
      lb += pc[2] * att;
    }
  }
  if (textured) return [lr * 255, lg * 255, lb * 255];
  const c = mat.col;
  const e = mat.emit;
  let r = c[0] * lr + (e ? e[0] : 0);
  let g = c[1] * lg + (e ? e[1] : 0);
  let b = c[2] * lb + (e ? e[2] : 0);
  if (L.fog) {
    let f = (vz - L.fogNear) / (L.fogFar - L.fogNear);
    f = f < 0 ? 0 : f > 1 ? 1 : f;
    r += (L.fog[0] - r) * f;
    g += (L.fog[1] - g) * f;
    b += (L.fog[2] - b) * f;
  }
  return [r, g, b];
}

/**
 * Draw meshes into target T. A mesh: { v: number[] (xyz…), f: [{ i:[a,b,c], n:[x,y,z], mat, uv? }],
 * off: [x,y,z], show }. mat: { col:[r,g,b] 0…255, emit?:[r,g,b], tex?:{w,h,px}, texMul?, litMul?, two? }.
 */
export function render(T, meshes, cam, L, { scan = 0 } = {}) {
  const hw = T.w / 2;
  const hh = T.h / 2;
  const kx = (cam.k / cam.aspect) * hw;
  const ky = cam.k * hh;
  const near = cam.near;
  for (const m of meshes) {
    if (!m.show) continue;
    const V = m.v;
    const n = V.length / 3;
    if (!m._vx || m._vx.length !== n) {
      m._vx = new Float32Array(n);
      m._vy = new Float32Array(n);
      m._vz = new Float32Array(n);
    }
    const vx = m._vx;
    const vy = m._vy;
    const vz = m._vz;
    const ox = m.off[0];
    const oy = m.off[1];
    const oz = m.off[2];
    for (let i = 0; i < n; i++) {
      const x = V[i * 3] + ox - cam.ex;
      const y = V[i * 3 + 1] + oy - cam.ey;
      const z = V[i * 3 + 2] + oz - cam.ez;
      vx[i] = x * cam.rx + z * cam.rz;
      vy[i] = x * cam.ux + y * cam.uy + z * cam.uz;
      vz[i] = x * cam.fx + y * cam.fy + z * cam.fz;
    }
    for (const f of m.f) {
      const [a, b, c] = f.i;
      if (vz[a] < near && vz[b] < near && vz[c] < near) continue;
      const mat = f.mat;
      const wx = V[a * 3] + ox;
      const wy = V[a * 3 + 1] + oy;
      const wz = V[a * 3 + 2] + oz;
      if (!mat.two && f.n[0] * (cam.ex - wx) + f.n[1] * (cam.ey - wy) + f.n[2] * (cam.ez - wz) <= 0) continue;
      const tex = mat.tex || null;
      const poly = [a, b, c].map((k, j) => {
        const c3 = shade(mat, f.n, V[k * 3] + ox, V[k * 3 + 1] + oy, V[k * 3 + 2] + oz, vz[k], L, !!tex);
        return { x: vx[k], y: vy[k], z: vz[k], r: c3[0], g: c3[1], b: c3[2], u: f.uv ? f.uv[j][0] : 0, v: f.uv ? f.uv[j][1] : 0 };
      });
      const p = vz[a] < near || vz[b] < near || vz[c] < near ? clipNear(poly, near) : poly;
      if (p.length < 3) continue;
      for (const q of p) {
        q.sx = Math.round(hw + (q.x * kx) / q.z);
        q.sy = Math.round(hh - (q.y * ky) / q.z);
        q.iz = 1 / q.z;
        // keep absurdly close vertices from overflowing the edge maths
        if (q.sx < -32768) q.sx = -32768;
        else if (q.sx > 32767) q.sx = 32767;
        if (q.sy < -32768) q.sy = -32768;
        else if (q.sy > 32767) q.sy = 32767;
      }
      for (let k = 1; k < p.length - 1; k++) tri(T, p[0], p[k], p[k + 1], tex, mat.texMul ?? 1, mat.litMul ?? 0, scan, mat.bias || 1);
    }
  }
}

// ── mesh building ─────────────────────────────────────────────────────────
export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mat = (col, extra = {}) => ({ col: typeof col === 'string' ? hex(col) : col, ...extra });
export const mesh = () => ({ v: [], f: [], off: [0, 0, 0], show: true });

const vert = (m, x, y, z) => m.v.push(x, y, z) / 3 - 1;

/** Add a triangle. Its normal faces away from `center` (for closed solids) or equals `n`. */
function face(m, i0, i1, i2, material, { center = null, n = null, uv = null } = {}) {
  const V = m.v;
  const ax = V[i0 * 3];
  const ay = V[i0 * 3 + 1];
  const az = V[i0 * 3 + 2];
  const ux = V[i1 * 3] - ax;
  const uy = V[i1 * 3 + 1] - ay;
  const uz = V[i1 * 3 + 2] - az;
  const wx = V[i2 * 3] - ax;
  const wy = V[i2 * 3 + 1] - ay;
  const wz = V[i2 * 3 + 2] - az;
  let nx = uy * wz - uz * wy;
  let ny = uz * wx - ux * wz;
  let nz = ux * wy - uy * wx;
  const l = Math.hypot(nx, ny, nz);
  if (l < 1e-9) return;
  nx /= l;
  ny /= l;
  nz /= l;
  if (n) [nx, ny, nz] = n;
  else if (center) {
    const cx = (ax + V[i1 * 3] + V[i2 * 3]) / 3 - center[0];
    const cy = (ay + V[i1 * 3 + 1] + V[i2 * 3 + 1]) / 3 - center[1];
    const cz = (az + V[i1 * 3 + 2] + V[i2 * 3 + 2]) / 3 - center[2];
    if (nx * cx + ny * cy + nz * cz < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
  }
  m.f.push({ i: [i0, i1, i2], n: [nx, ny, nz], mat: material, uv });
}

export function quad(m, a, b, c, d, material, opts = {}) {
  const ia = vert(m, ...a);
  const ib = vert(m, ...b);
  const ic = vert(m, ...c);
  const id = vert(m, ...d);
  const uv = opts.uv;
  face(m, ia, ib, ic, material, { ...opts, uv: uv && [uv[0], uv[1], uv[2]] });
  face(m, ia, ic, id, material, { ...opts, uv: uv && [uv[0], uv[2], uv[3]] });
}

/** Axis-aligned box. `mats` may be one material or { top, side, front, bottom }. skip: ['bottom', …]. */
export function box(m, x0, x1, y0, y1, z0, z1, mats, { skip = ['bottom'] } = {}) {
  const M = (k) => (mats.col ? mats : mats[k] || mats.side);
  const center = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const o = { center };
  if (!skip.includes('top')) quad(m, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], M('top'), o);
  if (!skip.includes('bottom')) quad(m, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], M('bottom'), o);
  if (!skip.includes('front')) quad(m, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], M('front'), o);
  if (!skip.includes('back')) quad(m, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], M('back'), o);
  if (!skip.includes('left')) quad(m, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], M('side'), o);
  if (!skip.includes('right')) quad(m, [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], M('side'), o);
}

/** Vertical cylinder (low-poly), cap on top. */
export function cylinder(m, cx, cz, r, y0, y1, sides, mats, { top = true } = {}) {
  const M = (k) => (mats.col ? mats : mats[k] || mats.side);
  const center = [cx, (y0 + y1) / 2, cz];
  for (let s = 0; s < sides; s++) {
    const a0 = (s / sides) * Math.PI * 2;
    const a1 = ((s + 1) / sides) * Math.PI * 2;
    const p0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r];
    const p1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
    quad(m, [p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], M('side'), { center });
    if (top) {
      const ic = vert(m, cx, y1, cz);
      const i0 = vert(m, p0[0], y1, p0[1]);
      const i1 = vert(m, p1[0], y1, p1[1]);
      face(m, ic, i0, i1, M('top'), { n: [0, 1, 0] });
    }
  }
}

/** Rotate (around Y) and move a whole mesh in place. */
export function place(m, yaw, tx, ty, tz) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  for (let i = 0; i < m.v.length; i += 3) {
    const x = m.v[i];
    const z = m.v[i + 2];
    m.v[i] = x * c + z * s + tx;
    m.v[i + 1] += ty;
    m.v[i + 2] = -x * s + z * c + tz;
  }
  for (const f of m.f) {
    const [x, y, z] = f.n;
    f.n = [x * c + z * s, y, -x * s + z * c];
  }
  return m;
}
