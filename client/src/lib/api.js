// Talks to the Express server. Every call has a timeout and fails with an ApiError
// whose message is safe to show on screen.

const TIMEOUT_MS = 8000;

export class ApiError extends Error {
  constructor(message, { status = 0, data = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 = never reached the server
    this.data = data;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, { method = 'GET', body, timeout = TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(`./api${path}`, {
      method,
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(err?.name === 'AbortError' ? 'The server took too long to answer.' : 'Could not reach the server.');
  } finally {
    clearTimeout(timer);
  }

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) throw new ApiError(data?.error || `The server answered ${res.status}.`, { status: res.status, data });
  if (data === null) throw new ApiError('The server sent something unexpected.', { status: res.status });
  return data;
}

/** All site content (server/data/*.json). Retries twice on network/server errors. */
export async function getContent() {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request('/content');
    } catch (err) {
      const retryable = err.status === 0 || err.status >= 500;
      if (!retryable || attempt === 3) throw err;
      await sleep(500 * attempt);
    }
  }
}

/** → { scores: [{ initials, gf, ga, points, createdAt }] } */
export const getScores = () => request('/scores');

/** → { rank, points, scores } */
export const submitScore = ({ initials, gf, ga }) => request('/scores', { method: 'POST', body: { initials, gf, ga } });

/** Counts one visit per browser session, then just reads the count. → number, or null if unavailable. */
export async function registerVisit() {
  const KEY = 'rudra.visit';
  let counted = false;
  try {
    counted = sessionStorage.getItem(KEY) === '1';
  } catch {
    /* storage blocked */
  }
  try {
    const { count } = await request('/visits', { method: counted ? 'GET' : 'POST' });
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* storage blocked */
    }
    return count;
  } catch {
    return null;
  }
}

/** Same rules as the server (models/score.model.js), so the result screen can show points at once. */
export const scorePoints = (gf, ga) => gf * 100 + Math.max(0, gf - ga) * 50 + (gf > ga ? 150 : gf === ga ? 50 : 0);
