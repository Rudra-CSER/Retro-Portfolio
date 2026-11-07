// 16×16 pixel-art sprites for quests, previews and icons.
// Hand-drawn ones are strings; geometric ones are generated.
// Palette letters map to colors; accent/red/ink follow the active site palette.

export const SPRITE_COLORS = {
  k: '#050505',
  w: 'var(--text)',
  g: 'var(--muted)',
  d: '#2A2926',
  a: 'var(--accent)',
  r: 'var(--p2)',
  R: '#7A1526',
  p: '#FF9AAE',
  b: '#3D7BFF',
  c: '#3DE8FF',
  G: '#2FBF71',
  D: '#14532F',
  y: '#FFE15A',
  o: '#FF8A3D',
  m: '#D35CFF',
  n: '#8A5A3B',
  s: '#E0A57A',
};

const hand = {
  tooth: [
    '................',
    '....kkkk.kkkk...',
    '...kwwwwkwwwwk..',
    '..kwwwwwwwwwwwk.',
    '..kwwwwwwwwwwgk.',
    '..kwwwwwwwwwwgk.',
    '..kwwwwwwwwwwgk.',
    '..kwwwwwwwwwggk.',
    '...kwwwwwwwwgk..',
    '...kwwwwwwwwgk..',
    '...kwwwkkwwwgk..',
    '...kwwk..kwwgk..',
    '...kwwk..kwgk...',
    '....kwk...kgk...',
    '....kk.....kk...',
    '..a.........a...',
  ],
  drop: [
    '.......kk.......',
    '......krrk......',
    '......krrk......',
    '.....krrrrk.....',
    '.....krrrrk.....',
    '....krrrrrrk....',
    '...krrrrrrrrk...',
    '...krprrrrrrk...',
    '..krpprrrrrrRk..',
    '..krprrrrrrrRk..',
    '..krrrrrrrrrRk..',
    '..krrrrrrrrRRk..',
    '...krrrrrrRRk...',
    '....kRRRRRRk....',
    '.....kkkkkk.....',
    '................',
  ],
  checker: [
    '................',
    '................',
    '..aaaa..........',
    'kkkkkkkkkkkkkkkk',
    'kddddddddddddddk',
    'kdrrdoodyydbbddk',
    'kdrrdoodyydbbddk',
    'kddddddddddddddk',
    'kdGGdccdmmdppddk',
    'kdGGdccdmmdppddk',
    'kddddddddddddddk',
    'kdwwdggdssdnnddk',
    'kdwwdggdssdnnddk',
    'kddddddddddddddk',
    'kkkkkkkkkkkkkkkk',
    '................',
  ],
  pi: [
    '................',
    '................',
    '.DDDDDDDDDDDDDD.',
    '.DyGyGyGyGyGyGD.',
    '.DGGGGGGGGGGGGgg',
    '.DGGkkkkGGGGGGgg',
    '.DGGkddkGGrGGGGD',
    '.DGGkkkkGGGGGGGD',
    '.DGGGGGGGGGGGGgg',
    '.DGGGGGGGGGGGGgg',
    '.DGgggGGGGaGGGGD',
    '.DDDDDDDDDDDDDD.',
    '................',
    '................',
    '................',
    '................',
  ],
  chat: [
    '........a.......',
    '..kkkkkkkkkkkk..',
    '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwaawwwwaawwk.',
    '.kwwaawwwwaawwk.',
    '.kwwwwwwwwwwwwk.',
    '.kwwwkkkkkkwwwk.',
    '.kwwwwwwwwwwwwk.',
    '..kkkkwwkkkkkk..',
    '......kwk.......',
    '.....kwk........',
    '.....kk.........',
    '................',
    '................',
    '................',
  ],
  bowl: [
    '....g....g......',
    '.....g....g...nn',
    '....g....g...nn.',
    '.....g....g.nn..',
    '...........nn...',
    '...wwwwwwwnwww..',
    '..wwwwwwwnwwwww.',
    '.aaaaaaaaaaaaaa.',
    '.oooooooooooooo.',
    '..oooooooooooo..',
    '..ooaaooooaaoo..',
    '...oooooooooo...',
    '....oooooooo....',
    '.....dddddd.....',
    '................',
    '................',
  ],
  flask: [
    '......kkkk......',
    '......kwgk......',
    '......kwgk......',
    '......kwgk......',
    '.....kwwwgk.....',
    '....kwwwwwgk....',
    '...kwwwwwwwgk...',
    '..kcccccccccck..',
    '.kcccwcccccccck.',
    '.kccccccccwccck.',
    '.kcccccccccccck.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
    '................',
    '................',
  ],
  doc: [
    '................',
    '..kkkkkkkkk.....',
    '..kwwwwwwwgk....',
    '..kwwwwwwwggk...',
    '..kwwwwwwwkkkk..',
    '..kwaaaawwwwwk..',
    '..kwwwwwwwwwwk..',
    '..kwddddddddwk..',
    '..kwwwwwwwwwwk..',
    '..kwddddddwwwk..',
    '..kwwwwwwwwwwk..',
    '..kwddddddddwk..',
    '..kwwwwwwwwwwk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ],
  bag: [
    '................',
    '................',
    '......kkkk......',
    '.....k....k.....',
    '.....k....k.....',
    '..kkkkkkkkkkkk..',
    '..kaaaaaaaaaak..',
    '..kaaaaaaaaaak..',
    '..kaaakkkkaaak..',
    '..kaaaaaaaaaak..',
    '..kaaaaaaaaaak..',
    '..kaaaaaaaaaak..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................',
  ],
  film: [
    '................',
    '................',
    '..aakkaakkaakk..',
    '..aakkaakkaakk..',
    '................',
    '..aakkaakkaakk..',
    '..kkkkkkkkkkkk..',
    '..kddddddddddk..',
    '..kdwwwwdddddk..',
    '..kddddddddddk..',
    '..kdwwwdwwwwdk..',
    '..kddddddddddk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................',
  ],
  eye: [
    '................',
    '................',
    '................',
    '.....kkkkkk.....',
    '...kkwwwwwwkk...',
    '..kwwwkkkkwwwk..',
    '.kwwwkaaaakwwwk.',
    '.kwwwkakkakwwwk.',
    '.kwwwkaaaakwwwk.',
    '..kwwwkkkkwwwk..',
    '...kkwwwwwwkk...',
    '.....kkkkkk.....',
    '................',
    '................',
    '................',
    '................',
  ],
};

// ── generated sprites ──────────────────────────────────────────────────────
const blank = () => Array.from({ length: 16 }, () => Array(16).fill('.'));
const put = (g, x, y, c) => {
  x = Math.round(x);
  y = Math.round(y);
  if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = c;
};
function line(g, x0, y0, x1, y1, c) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    put(g, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
const disk = (g, cx, cy, r, c) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) g[y][x] = c;
};
const box = (g, x, y, w, h, c) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(g, i, j, c);
};
const toRows = (g) => g.map((r) => r.join(''));

const gen = {
  nodes() {
    const g = blank();
    const pts = [[2, 2], [13, 3], [3, 13], [13, 12], [7, 8]];
    [[0, 4], [1, 4], [2, 4], [3, 4], [0, 1], [2, 3]].forEach(([a, b]) => line(g, pts[a][0], pts[a][1], pts[b][0], pts[b][1], 'g'));
    pts.forEach(([x, y], i) => (i === 4 ? box(g, x - 1, y - 1, 3, 3, 'w') : box(g, x - 1, y - 1, 2, 2, 'a')));
    return toRows(g);
  },
  molecule() {
    const g = blank();
    const cx = 7, cy = 8, r = 4.6;
    const v = Array.from({ length: 6 }, (_, k) => [cx + r * Math.cos((Math.PI / 3) * k + Math.PI / 6), cy + r * Math.sin((Math.PI / 3) * k + Math.PI / 6)].map(Math.round));
    v.forEach((p, k) => line(g, p[0], p[1], v[(k + 1) % 6][0], v[(k + 1) % 6][1], 'w'));
    line(g, v[5][0], v[5][1], 14, 1, 'g');
    line(g, v[2][0], v[2][1], 1, 14, 'g');
    box(g, 13, 0, 2, 2, 'r');
    box(g, 0, 14, 2, 2, 'c');
    v.forEach(([x, y]) => put(g, x, y, 'a'));
    return toRows(g);
  },
  vinyl() {
    const g = blank();
    disk(g, 7.5, 7.5, 7.2, 'k');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 7.2 && (Math.abs(d - 5.4) < 0.45 || Math.abs(d - 3.9) < 0.4)) g[y][x] = 'd';
    }
    disk(g, 7.5, 7.5, 2.4, 'a');
    box(g, 7, 7, 2, 2, '.');
    put(g, 11, 3, 'w');
    put(g, 12, 4, 'w');
    return toRows(g);
  },
  cube() {
    const g = blank();
    const top = [[8, 2], [14, 5], [8, 8], [2, 5]];
    for (let y = 2; y <= 8; y++) for (let x = 2; x <= 14; x++) {
      const inTop = Math.abs(x - 8) / 6 + Math.abs(y - 5) / 3 <= 1;
      if (inTop) put(g, x, y, 'a');
    }
    box(g, 2, 5, 6, 7, 'g'); box(g, 8, 5, 7, 7, 'w');
    for (let x = 2; x <= 14; x++) for (let y = 5; y <= 8; y++) if (Math.abs(x - 8) / 6 + Math.abs(y - 5) / 3 <= 1) put(g, x, y, 'a');
    for (let i = 0; i <= 6; i++) { put(g, 2 + i, 12 + Math.floor(i / 2), 'g'); put(g, 14 - i, 12 + Math.floor(i / 2), 'w'); }
    top.forEach(([x, y], k) => line(g, x, y, top[(k + 1) % 4][0], top[(k + 1) % 4][1], 'k'));
    line(g, 8, 8, 8, 15, 'k');
    return toRows(g);
  },
  ball() {
    const g = blank();
    disk(g, 7.5, 7.5, 6.6, 'w');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d >= 6.0 && d < 7.1) g[y][x] = 'k';
    }
    box(g, 6, 6, 4, 4, 'k');
    box(g, 2, 3, 2, 2, 'k'); box(g, 12, 3, 2, 2, 'k'); box(g, 2, 11, 2, 2, 'k'); box(g, 12, 11, 2, 2, 'k'); box(g, 7, 1, 2, 2, 'k'); box(g, 7, 13, 2, 2, 'k');
    put(g, 5, 4, 'a');
    return toRows(g);
  },
  gem() {
    const g = blank();
    for (let y = 3; y <= 13; y++) {
      const half = y <= 6 ? 3 + (y - 3) : Math.max(0, 6 - Math.round((y - 6) * 0.86));
      for (let x = 8 - half; x < 8 + half; x++) put(g, x, y, y <= 6 ? 'w' : x < 8 ? 'a' : 'o');
    }
    for (let x = 2; x < 14; x++) put(g, x, 6, 'y');
    put(g, 6, 4, 'k'); put(g, 9, 4, 'k');
    return toRows(g);
  },
  coin() {
    const g = blank();
    disk(g, 7.5, 7.5, 6.5, 'a');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d >= 5.4 && d < 6.6) g[y][x] = 'o';
    }
    box(g, 7, 4, 2, 8, 'y');
    return toRows(g);
  },
  trophy() {
    const g = blank();
    box(g, 4, 2, 8, 6, 'a'); box(g, 5, 8, 6, 1, 'a'); box(g, 7, 9, 2, 3, 'a'); box(g, 5, 12, 6, 2, 'o');
    box(g, 2, 3, 2, 3, 'a'); box(g, 12, 3, 2, 3, 'a'); put(g, 3, 4, '.'); put(g, 12, 4, '.');
    box(g, 6, 3, 1, 3, 'y');
    return toRows(g);
  },
};

const cache = new Map();
export function getSprite(name) {
  if (cache.has(name)) return cache.get(name);
  const rows = hand[name] || (gen[name] ? gen[name]() : gen.gem());
  // normalise to 16×16 so a mis-sized row can never break rendering
  const norm = Array.from({ length: 16 }, (_, y) => (rows[y] || '').padEnd(16, '.').slice(0, 16));
  cache.set(name, norm);
  return norm;
}
