// API client with graceful fallbacks, so the same build also runs as a
// static preview with no server behind it.
import bundled from '@content';

const TIMEOUT = 4000;

async function req(path, { method = 'GET', body, timeout = TIMEOUT } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`./api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json() : null;
    if (!isJson || [404, 405, 501, 502, 503, 504].includes(res.status)) throw Object.assign(new Error('offline'), { offline: true });
    if (!res.ok) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status, data });
    return data;
  } catch (err) {
    if (err.name === 'AbortError' || err instanceof TypeError) err.offline = true;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const bundledContent = bundled;

let online = null; // null = unknown, true/false after first call
export const isOnline = () => online;

export async function fetchContent() {
  try {
    const data = await req('/content', { timeout: 1800 });
    online = true;
    return data;
  } catch {
    online = false;
    return null;
  }
}

export async function fetchHealth() {
  try {
    const data = await req('/health', { timeout: 1800 });
    online = true;
    return data;
  } catch {
    online = false;
    return null;
  }
}

export async function sendMessage(payload) {
  return req('/contact', { method: 'POST', body: payload });
}

// ── leaderboard (server, else this browser) ────────────────────────────────
const LOCAL_KEY = 'rudra.scores';
const localScores = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
};
const points = (gf, ga) => Math.max(0, gf * 100 + Math.max(0, gf - ga) * 50 + (gf > ga ? 150 : gf === ga ? 50 : 0));

export async function fetchScores() {
  try {
    const data = await req('/scores');
    return { scores: data.scores, local: false };
  } catch {
    return { scores: localScores().slice(0, 10), local: true };
  }
}

export async function submitScore({ initials, gf, ga }) {
  try {
    const data = await req('/scores', { method: 'POST', body: { initials, gf, ga } });
    return { ...data, local: false };
  } catch (err) {
    if (!err.offline) throw err;
    const entry = { initials, gf, ga, points: points(gf, ga), createdAt: new Date().toISOString() };
    const list = [...localScores(), entry].sort((a, b) => b.points - a.points).slice(0, 50);
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    } catch {
      /* storage blocked */
    }
    return { ok: true, rank: list.indexOf(entry) + 1, points: entry.points, scores: list.slice(0, 10), local: true };
  }
}

export async function registerVisit() {
  let counted = false;
  try {
    counted = sessionStorage.getItem('rudra.visit') === '1';
  } catch {
    /* ignore */
  }
  try {
    const data = await req('/visits', { method: counted ? 'GET' : 'POST' });
    try {
      sessionStorage.setItem('rudra.visit', '1');
    } catch {
      /* ignore */
    }
    return data.count;
  } catch {
    return null;
  }
}

export const scorePoints = points;
