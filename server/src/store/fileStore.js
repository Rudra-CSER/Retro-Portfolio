// Zero-dependency fallback store: JSON files in server/storage/.
// Writes are serialized through one promise chain and committed atomically
// (write to .tmp, then rename), so a crash never leaves a half-written file.
import fs from 'node:fs/promises';
import path from 'node:path';

export async function createFileStore({ storageDir, contentPath }) {
  await fs.mkdir(storageDir, { recursive: true });
  const file = (name) => path.join(storageDir, `${name}.json`);
  let chain = Promise.resolve();

  async function read(name, fallback) {
    try {
      return JSON.parse(await fs.readFile(file(name), 'utf8'));
    } catch {
      return fallback;
    }
  }

  // Read-modify-write inside the same chain so concurrent requests can't interleave.
  function update(name, fallback, fn) {
    const run = async () => {
      const current = await read(name, fallback);
      const { next, result } = fn(current);
      const tmp = `${file(name)}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(next, null, 2));
      await fs.rename(tmp, file(name));
      return result;
    };
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  }

  return {
    mode: 'file',

    async getContent() {
      return JSON.parse(await fs.readFile(contentPath, 'utf8'));
    },

    async seed() {
      return false; // content is read straight from data/content.json in file mode
    },

    async addMessage(msg) {
      await update('messages', [], (list) => {
        const next = [...list, { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...msg, read: false, createdAt: new Date().toISOString() }];
        return { next: next.slice(-2000), result: true };
      });
    },

    async listMessages(limit = 50) {
      const list = await read('messages', []);
      return list.slice(-limit).reverse().map(({ ip, ...m }) => m);
    },

    async topScores(limit = 10) {
      const list = await read('scores', []);
      return [...list]
        .sort((a, b) => b.points - a.points || new Date(a.createdAt) - new Date(b.createdAt))
        .slice(0, limit)
        .map(({ initials, points, gf, ga, createdAt }) => ({ initials, points, gf, ga, createdAt }));
    },

    async addScore(score) {
      return update('scores', [], (list) => {
        const entry = { ...score, createdAt: new Date().toISOString() };
        const next = [...list, entry].sort((a, b) => b.points - a.points).slice(0, 500);
        const rank = next.filter((s) => s.points > score.points).length + 1;
        return { next, result: { rank } };
      });
    },

    async incrementVisits() {
      return update('counters', { visits: 0 }, (c) => {
        const next = { ...c, visits: (c.visits || 0) + 1 };
        return { next, result: next.visits };
      });
    },

    async getVisits() {
      return (await read('counters', { visits: 0 })).visits || 0;
    },

    async close() {
      await chain;
    },
  };
}
