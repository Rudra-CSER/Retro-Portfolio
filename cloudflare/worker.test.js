// API tests for the Cloudflare version (cloudflare/api.js), with an in-memory SQLite database
// standing in for D1. They check that it answers exactly like the Express server.
//   npm test        (these need Node 22.13+ for node:sqlite; on older Node they are skipped)
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { pointsFor } from '../server/src/models/score.model.js';
import { KEEP_SCORES } from '../server/src/services/scores.service.js';
import { createApi } from './api.js';
import { siteData } from './build.js';

let DatabaseSync;
try {
  ({ DatabaseSync } = await import('node:sqlite'));
} catch {
  /* Node older than 22.13 */
}
const skip = DatabaseSync ? false : 'needs Node 22.13+ (node:sqlite stands in for D1)';

/** Just enough of the D1 API (prepare/bind/first/all/run/batch) on top of node:sqlite. */
function fakeD1() {
  const db = new DatabaseSync(':memory:');
  const exec = (sql, params) => {
    const results = db
      .prepare(sql)
      .all(...params)
      .map((row) => ({ ...row }));
    const { c } = db.prepare('SELECT changes() AS c').get();
    return { results, success: true, meta: { changes: Number(c) } };
  };
  const statement = (sql, params = []) => ({
    bind: (...values) => statement(sql, values),
    run: async () => exec(sql, params),
    all: async () => exec(sql, params),
    first: async () => exec(sql, params).results[0] ?? null,
    exec: () => exec(sql, params),
  });
  return {
    prepare: (sql) => statement(sql),
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const out = statements.map((s) => s.exec());
        db.exec('COMMIT');
        return out;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    count: (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,
    rows: (sql) => db.prepare(sql).all().map((row) => ({ ...row })),
  };
}

const silent = { error() {} };

async function startApi() {
  const data = await siteData();
  const api = createApi(data, { logger: silent });
  const env = { DB: fakeD1() };
  const request = async (path, { method = 'GET', json, body, headers = {}, ip = '203.0.113.7' } = {}) => {
    const init = { method, headers: { 'cf-connecting-ip': ip, ...headers } };
    if (json !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(json);
    } else if (body !== undefined) {
      init.body = body;
    }
    const res = await api(new Request(`https://rudramundal.dev${path}`, init), env);
    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: res.status, headers: res.headers, data: parsed, text };
  };
  return { data, env, request };
}

describe('Cloudflare API: content', { skip }, () => {
  let site;
  before(async () => {
    site = await startApi();
  });

  test('health check', async () => {
    const res = await site.request('/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.data, { ok: true });
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  test('serves all content, with the same security headers as the Express server', async () => {
    const res = await site.request('/api/content');
    assert.equal(res.status, 200);
    assert.deepEqual(res.data, site.data.content);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
    assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('content-type'), /application\/json/);
  });

  test('answers 304 when the browser already has this version (also for weak tags)', async () => {
    const { etag } = site.data;
    assert.equal((await site.request('/api/content', { headers: { 'if-none-match': etag } })).status, 304);
    assert.equal((await site.request('/api/content', { headers: { 'if-none-match': `W/${etag}` } })).status, 304);
    assert.equal((await site.request('/api/content', { headers: { 'if-none-match': '"old"' } })).status, 200);
  });

  test('serves one file, and names the real ones for a typo', async () => {
    const res = await site.request('/api/content/projects');
    assert.equal(res.status, 200);
    assert.deepEqual(res.data, site.data.sections.projects);
    const missing = await site.request('/api/content/nope');
    assert.equal(missing.status, 404);
    assert.equal(missing.data.error, 'No content section "nope". Try: profile, skills, projects, achievements, site.');
  });

  test('unknown routes and methods get a JSON 404', async () => {
    const res = await site.request('/api/scores?x=1', { method: 'PUT' });
    assert.equal(res.status, 404);
    assert.equal(res.data.error, 'No API route for PUT /api/scores?x=1');
  });

  test('a trailing slash and HEAD work like in Express', async () => {
    assert.equal((await site.request('/api/health/')).status, 200);
    assert.equal((await site.request('/api/health', { method: 'HEAD' })).status, 200);
  });
});

describe('Cloudflare API: PIXEL CUP leaderboard', { skip }, () => {
  let site;
  before(async () => {
    site = await startApi();
  });

  test('starts empty', async () => {
    const { status, data } = await site.request('/api/scores');
    assert.equal(status, 200);
    assert.deepEqual(data, { scores: [] });
  });

  test('saves a result and computes the points itself', async () => {
    const { status, data } = await site.request('/api/scores', { method: 'POST', json: { initials: 'rnm', gf: 3, ga: 1, points: 999999 } });
    assert.equal(status, 201);
    assert.equal(data.points, pointsFor(3, 1));
    assert.equal(data.points, 550);
    assert.equal(data.rank, 1);
    assert.equal(data.scores[0].initials, 'RNM');
    assert.match(data.scores[0].createdAt, /^\d{4}-\d\d-\d\dT/);
  });

  test('ranks by points, earlier entry first on a tie', async () => {
    await site.request('/api/scores', { method: 'POST', json: { initials: 'AAA', gf: 5, ga: 0 } });
    const tie = await site.request('/api/scores', { method: 'POST', json: { initials: 'BBB', gf: 3, ga: 1 } });
    assert.equal(tie.data.rank, 3);
    const { data } = await site.request('/api/scores');
    assert.deepEqual(
      data.scores.map((s) => s.initials),
      ['AAA', 'RNM', 'BBB'],
    );
  });

  test('rejects bad input with a message per field', async () => {
    const { status, data } = await site.request('/api/scores', { method: 'POST', json: { initials: 'A!', gf: 2.5, ga: 99 } });
    assert.equal(status, 400);
    assert.deepEqual(Object.keys(data.fields).sort(), ['ga', 'gf', 'initials']);
    assert.equal(data.error, data.fields.initials);
  });

  test('rejects a body that is not JSON, or too big', async () => {
    const bad = await site.request('/api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
    assert.equal(bad.status, 400);
    assert.equal(bad.data.error, 'The request body must be valid JSON.');
    const big = await site.request('/api/scores', { method: 'POST', json: { initials: 'BIG', gf: 1, ga: 0, pad: 'x'.repeat(3000) } });
    assert.equal(big.status, 413);
  });

  test(`keeps only the best ${KEEP_SCORES} results and shows the top 10`, async () => {
    for (let i = 0; i < KEEP_SCORES + 5; i++) {
      await site.request('/api/scores', { method: 'POST', json: { initials: 'LOT', gf: i % 30, ga: 0 }, ip: `198.51.100.${i}` });
    }
    assert.equal(site.env.DB.count('scores'), KEEP_SCORES);
    const { data } = await site.request('/api/scores');
    assert.equal(data.scores.length, 10);
    assert.ok(data.scores.every((s, i, all) => i === 0 || all[i - 1].points >= s.points));
  });
});

describe('Cloudflare API: visitor counter and rate limits', { skip }, () => {
  test('counts visits, also in parallel', async () => {
    const site = await startApi();
    assert.equal((await site.request('/api/visits')).data.count, 0);
    assert.equal((await site.request('/api/visits', { method: 'POST' })).data.count, 1);
    await Promise.all(Array.from({ length: 12 }, (_, i) => site.request('/api/visits', { method: 'POST', ip: `192.0.2.${i}` })));
    assert.equal((await site.request('/api/visits')).data.count, 13);
  });

  test('20 scores per visitor every 10 minutes, then 429; other visitors are unaffected', async () => {
    const site = await startApi();
    const post = (ip) => site.request('/api/scores', { method: 'POST', json: { initials: 'SPM', gf: 1, ga: 0 }, ip });
    for (let i = 0; i < 20; i++) assert.equal((await post('203.0.113.9')).status, 201);
    const blocked = await post('203.0.113.9');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.data.error, 'Slow down, striker. Try again in a few minutes.');
    assert.equal(blocked.headers.get('retry-after'), '600');
    assert.equal((await post('203.0.113.10')).status, 201);
  });

  test('blocked requests write nothing, and addresses are stored only as hashes', async () => {
    const site = await startApi();
    for (let i = 0; i < 35; i++) await site.request('/api/visits', { method: 'POST', ip: '203.0.113.50' });
    assert.equal((await site.request('/api/visits')).data.count, 30);
    assert.equal(site.env.DB.count('hits'), 30);
    const stored = site.env.DB.rows('SELECT DISTINCT who FROM hits');
    assert.equal(stored.length, 1);
    assert.match(stored[0].who, /^[0-9a-f]{16}$/);
    const res = await site.request('/api/visits', { method: 'POST', ip: '203.0.113.50' });
    assert.equal(res.status, 429);
    assert.equal(res.data.error, 'Easy there.');
  });

  test('a database failure is a 500 with a plain message', async () => {
    const site = await startApi();
    site.env.DB = {
      prepare: () => {
        throw new Error('D1 is down');
      },
      batch: async () => {
        throw new Error('D1 is down');
      },
    };
    const res = await site.request('/api/scores');
    assert.equal(res.status, 500);
    assert.deepEqual(res.data, { error: 'Something went wrong on the server.' });
    assert.equal((await site.request('/api/content')).status, 200, 'content does not need the database');
  });
});
