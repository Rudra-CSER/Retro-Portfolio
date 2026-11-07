// A JSON file the server owns (storage/scores.json, storage/visits.json).
// - Loaded once into memory; reads never touch the disk.
// - Writes run one at a time and are atomic (write a temp file, then rename),
//   so a crash or power cut can never leave a half-written file.
// - Memory only changes after the file was written, so the two never disagree.
// - A missing file starts from `defaults`; an unreadable one is moved aside
//   (scores.json.corrupt-<time>) and the server carries on.
import fs from 'node:fs/promises';
import path from 'node:path';

export async function openJsonStore(file, { defaults, sanitize = (v) => v, logger = console }) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const name = path.basename(file);
  let data;

  try {
    data = sanitize(JSON.parse(await fs.readFile(file, 'utf8')));
  } catch (err) {
    data = structuredClone(defaults);
    if (err.code !== 'ENOENT') {
      const aside = `${file}.corrupt-${Date.now()}`;
      await fs.rename(file, aside).catch(() => {});
      logger.warn(`[storage] ${name} could not be read (${err.message}). Moved it to ${path.basename(aside)} and started fresh.`);
    }
  }

  let queue = Promise.resolve();
  let tmpCounter = 0;

  async function write(value) {
    const tmp = `${file}.${process.pid}.${++tmpCounter}.tmp`;
    try {
      await fs.mkdir(path.dirname(file), { recursive: true }); // in case the folder was deleted while running
      await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`);
      await fs.rename(tmp, file);
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => {});
      throw err;
    }
  }

  return {
    /** Current value (treat as read-only). */
    get: () => data,

    /** fn(current) → next. Resolves with `next` once it is safely on disk. */
    update(fn) {
      const run = async () => {
        const next = fn(data);
        await write(next);
        data = next;
        return next;
      };
      const result = queue.then(run, run);
      queue = result.catch(() => {});
      return result;
    },

    /** Resolves when every queued write has finished. */
    flush: () => queue,
  };
}
