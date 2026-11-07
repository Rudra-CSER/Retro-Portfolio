// Picks the storage backend: MongoDB when MONGODB_URI is set and reachable,
// otherwise JSON files on disk. Both expose the same interface:
//   mode, getContent(), seed(content, {force}), addMessage(), listMessages(n),
//   topScores(n), addScore(), incrementVisits(), getVisits(), close()
import fs from 'node:fs/promises';
import { createFileStore } from './fileStore.js';

export async function readContentFile(contentPath) {
  return JSON.parse(await fs.readFile(contentPath, 'utf8'));
}

export async function createStore({ mongoUri, contentPath, storageDir, log = console }) {
  const content = await readContentFile(contentPath);

  if (mongoUri) {
    try {
      const { createMongoStore } = await import('./mongoStore.js');
      const store = await createMongoStore(mongoUri);
      await store.seed(content, { force: false });
      log.log(`[store] MongoDB connected → ${redact(mongoUri)}`);
      return store;
    } catch (err) {
      log.warn(`[store] MongoDB unavailable (${err.message.split('\n')[0]}). Falling back to file mode.`);
    }
  } else {
    log.log('[store] MONGODB_URI not set — using file mode.');
  }

  const store = await createFileStore({ storageDir, contentPath });
  log.log(`[store] File mode → ${storageDir}`);
  return store;
}

function redact(uri) {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:****@');
}
