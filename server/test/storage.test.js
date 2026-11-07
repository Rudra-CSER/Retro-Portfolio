import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { sanitizeStoredScores } from '../src/models/score.model.js';
import { openJsonStore } from '../src/utils/jsonStore.js';
import { memoryLogger } from './helpers.js';

const tempFile = async (name) => path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'rudra-store-')), name);

test('a missing file starts from the defaults', async () => {
  const store = await openJsonStore(await tempFile('a.json'), { defaults: { count: 0 } });
  assert.deepEqual(store.get(), { count: 0 });
});

test('writes are queued, atomic and leave no temp files behind', async () => {
  const file = await tempFile('b.json');
  const store = await openJsonStore(file, { defaults: { count: 0 } });
  await Promise.all(Array.from({ length: 25 }, () => store.update(({ count }) => ({ count: count + 1 }))));
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), { count: 25 });
  assert.deepEqual(await fs.readdir(path.dirname(file)), ['b.json']);
});

test('an unreadable file is moved aside and the server carries on', async () => {
  const file = await tempFile('scores.json');
  await fs.writeFile(file, '{ this is not json');
  const logger = memoryLogger();
  const store = await openJsonStore(file, { defaults: [], sanitize: sanitizeStoredScores, logger });
  assert.deepEqual(store.get(), []);
  const files = await fs.readdir(path.dirname(file));
  assert.ok(files.some((f) => f.startsWith('scores.json.corrupt-')));
  assert.match(logger.lines.warn[0], /could not be read/);
});

test('hand-edited scores are cleaned up and re-scored on load', async () => {
  const file = await tempFile('scores.json');
  await fs.writeFile(
    file,
    JSON.stringify([
      { initials: 'ZZZ', gf: 1, ga: 0, points: 1e9, createdAt: '2026-11-01T00:00:00.000Z' },
      { initials: 'bad!', gf: 1, ga: 0, createdAt: '2026-11-01T00:00:00.000Z' },
      { initials: 'TOP', gf: 4, ga: 0, createdAt: '2026-11-02T00:00:00.000Z' },
    ]),
  );
  const store = await openJsonStore(file, { defaults: [], sanitize: sanitizeStoredScores });
  assert.deepEqual(
    store.get().map((s) => [s.initials, s.points]),
    [
      ['TOP', 750],
      ['ZZZ', 300],
    ],
  );
});

test('a failed write leaves memory unchanged and no temp file behind', async () => {
  const file = await tempFile('c.json');
  const store = await openJsonStore(file, { defaults: { count: 1 } });
  await fs.mkdir(file); // a folder where the file should go: the final rename fails
  await assert.rejects(store.update(() => ({ count: 2 })));
  assert.deepEqual(store.get(), { count: 1 });
  assert.deepEqual(await fs.readdir(path.dirname(file)), ['c.json']);
});

test('the storage folder is recreated if it was deleted while running', async () => {
  const file = await tempFile('d.json');
  const store = await openJsonStore(file, { defaults: { count: 0 } });
  await fs.rm(path.dirname(file), { recursive: true });
  await store.update(({ count }) => ({ count: count + 1 }));
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), { count: 1 });
});
