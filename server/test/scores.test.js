import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { pointsFor } from '../src/models/score.model.js';
import { makeDirs, startServer } from './helpers.js';

describe('PIXEL CUP leaderboard', () => {
  let site;
  before(async () => {
    site = await startServer();
  });
  after(() => site.stop());

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

  test('rejects a body that is not JSON', async () => {
    const res = await site.request('/api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
    assert.equal(res.status, 400);
    assert.equal(res.data.error, 'The request body must be valid JSON.');
  });

  test('is written to storage/scores.json', async () => {
    const saved = JSON.parse(await fs.readFile(path.join(site.dirs.storage, 'scores.json'), 'utf8'));
    assert.equal(saved.length, 3);
    assert.equal(saved[0].initials, 'AAA');
  });
});

describe('visitor counter', () => {
  test('counts visits and keeps the count across restarts', async () => {
    const dirs = await makeDirs();
    let site = await startServer({ dirs });
    assert.equal((await site.request('/api/visits')).data.count, 0);
    assert.equal((await site.request('/api/visits', { method: 'POST' })).data.count, 1);
    assert.equal((await site.request('/api/visits', { method: 'POST' })).data.count, 2);
    await site.stop();

    site = await startServer({ dirs });
    assert.equal((await site.request('/api/visits')).data.count, 2);
    await site.stop();
  });

  test('parallel visits are all counted', async () => {
    const site = await startServer();
    await Promise.all(Array.from({ length: 12 }, () => site.request('/api/visits', { method: 'POST' })));
    assert.equal((await site.request('/api/visits')).data.count, 12);
    await site.stop();
  });
});
