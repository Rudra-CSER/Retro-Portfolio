// The site's API on Cloudflare: the same routes, answers and rules as the Express server
// (server/src/routes/api.routes.js), with the leaderboard and visitor counter in D1 (storage.js).
//   GET  /api/health              → { ok: true }
//   GET  /api/content             → all site content (built from server/data by build.js)
//   GET  /api/content/:section    → one file, e.g. /api/content/projects
//   GET  /api/scores              → PIXEL CUP top 10
//   POST /api/scores              → { initials, gf, ga }
//   GET  /api/visits              → { count }
//   POST /api/visits              → count this visit
import { pointsFor, validateScoreInput } from '../server/src/models/score.model.js';
import { KEEP_SCORES } from '../server/src/services/scores.service.js';
import { HttpError } from '../server/src/utils/httpError.js';
import { addScore, allow, countVisit, readVisits, topScores } from './storage.js';

const BOARD_SIZE = 10; // as in controllers/scores.controller.js
const MAX_BODY_BYTES = 2048; // express.json({ limit: '2kb' })

// The same limits as server/src/routes/scores.routes.js and visits.routes.js.
const LIMITS = {
  scores: { limit: 20, minutes: 10, message: 'Slow down, striker. Try again in a few minutes.' },
  visits: { limit: 30, minutes: 60, message: 'Easy there.' },
};

/**
 * @param {{ content: object, sections: Record<string, unknown>, etag: string, headers: Record<string, string> }} data
 *   from build/worker-data.json
 * @returns {(request: Request, env: { DB: D1Database }) => Promise<Response>}
 */
export function createApi(data, { logger = console } = {}) {
  const baseHeaders = { ...data.headers, 'Content-Type': 'application/json; charset=utf-8' };

  function json(body, { status = 200, cache = 'no-store', headers = {} } = {}) {
    return new Response(JSON.stringify(body), { status, headers: { ...baseHeaders, 'Cache-Control': cache, ...headers } });
  }

  function content(request) {
    // Browsers keep a copy and check back each time; an unchanged site costs a 304.
    const headers = { ETag: data.etag };
    if (etagMatches(request.headers.get('if-none-match'), data.etag)) {
      return new Response(null, { status: 304, headers: { ...data.headers, 'Cache-Control': 'no-cache', ...headers } });
    }
    return json(data.content, { cache: 'no-cache', headers });
  }

  function contentSection(name) {
    const section = Object.hasOwn(data.sections, name) ? data.sections[name] : null;
    if (!section) throw new HttpError(404, `No content section "${name}". Try: ${Object.keys(data.sections).join(', ')}.`);
    return json(section, { cache: 'no-cache' });
  }

  async function limited(request, env, bucket) {
    const rule = LIMITS[bucket];
    if (await allow(env.DB, bucket, await visitorKey(request), rule)) return null;
    return json({ error: rule.message }, { status: 429, headers: { 'Retry-After': String(rule.minutes * 60) } });
  }

  async function postScore(request, env) {
    const body = await readJsonBody(request);
    const blocked = await limited(request, env, 'scores');
    if (blocked) return blocked;
    const { value, errors } = validateScoreInput(body);
    if (errors) throw new HttpError(400, Object.values(errors)[0], { fields: errors });
    const result = await addScore(env.DB, { ...value, points: pointsFor(value.gf, value.ga) }, { keep: KEEP_SCORES, board: BOARD_SIZE });
    return json(result, { status: 201 });
  }

  async function postVisit(request, env) {
    const blocked = await limited(request, env, 'visits');
    if (blocked) return blocked;
    return json({ count: await countVisit(env.DB) });
  }

  async function route(request, env, url) {
    const method = request.method === 'HEAD' ? 'GET' : request.method;
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : url.pathname;

    switch (`${method} ${path}`) {
      case 'GET /api/health':
        return json({ ok: true });
      case 'GET /api/content':
        return content(request);
      case 'GET /api/scores':
        return json({ scores: await topScores(env.DB, BOARD_SIZE) });
      case 'POST /api/scores':
        return postScore(request, env);
      case 'GET /api/visits':
        return json({ count: await readVisits(env.DB) });
      case 'POST /api/visits':
        return postVisit(request, env);
    }

    const section = method === 'GET' ? /^\/api\/content\/([^/]+)$/.exec(path) : null;
    if (section) return contentSection(safeDecode(section[1]));

    throw new HttpError(404, `No API route for ${request.method} ${url.pathname}${url.search}`);
  }

  /** Handles a request under /api. Errors become JSON; details of real crashes go to the log only. */
  return async function api(request, env) {
    const url = new URL(request.url);
    try {
      return await route(request, env, url);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, ...(err.details || {}) }, { status: err.status });
      logger.error(`[error] ${request.method} ${url.pathname}`, err);
      return json({ error: 'Something went wrong on the server.' }, { status: 500 });
    }
  };
}

/** Like express.json(): only JSON bodies are read, at most 2 kB, and they must be an object or a list. */
async function readJsonBody(request) {
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') return undefined;
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new HttpError(413, 'The request body is too large.');
  const text = new TextDecoder().decode(await readAtMost(request, MAX_BODY_BYTES));
  if (text.trim() === '') return {};
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    value = undefined;
  }
  if (value === null || typeof value !== 'object') throw new HttpError(400, 'The request body must be valid JSON.');
  return value;
}

/** Reads the body but gives up (413) past `max` bytes, even when no Content-Length was sent. */
async function readAtMost(request, max) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, 'The request body is too large.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** A short hash of the visitor's IP address, so the rate limits never store the address itself. */
async function visitorKey(request) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rudra.rom|${ip}`));
  return [...new Uint8Array(digest, 0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** If-None-Match can list several tags, and Cloudflare may mark ours weak (W/"…") after compressing. */
function etagMatches(header, etag) {
  if (!header) return false;
  const bare = (tag) => tag.trim().replace(/^W\//, '');
  return header.split(',').some((tag) => tag.trim() === '*' || bare(tag) === bare(etag));
}

function safeDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
