// Starts the real app on a random port, with its own temp copy of server/data,
// an empty storage folder and a small stand-in for the built index.html.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';

export const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');

export const INDEX_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <title>Default title</title>
    <meta name="description" content="Default description" />
    <meta property="og:title" content="Default share title" />
    <meta property="og:description" content="Default share description" />
  </head>
  <body><div id="root"></div></body>
</html>
`;

/** A logger that remembers what was printed instead of printing it. */
export function memoryLogger() {
  const lines = { log: [], warn: [], error: [] };
  return {
    lines,
    log: (...a) => lines.log.push(a.join(' ')),
    warn: (...a) => lines.warn.push(a.join(' ')),
    error: (...a) => lines.error.push(a.map(String).join(' ')),
  };
}

export async function makeDirs({ withIndex = true } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rudra-test-'));
  const dirs = {
    root,
    data: path.join(root, 'data'),
    public: path.join(root, 'public'),
    storage: path.join(root, 'storage'),
    dist: path.join(root, 'dist'),
  };
  await fs.cp(DATA_DIR, dirs.data, { recursive: true });
  await fs.mkdir(dirs.public, { recursive: true });
  await fs.mkdir(dirs.dist, { recursive: true });
  if (withIndex) await fs.writeFile(path.join(dirs.dist, 'index.html'), INDEX_TEMPLATE);
  return dirs;
}

export async function readData(dirs, file) {
  return JSON.parse(await fs.readFile(path.join(dirs.data, file), 'utf8'));
}

export async function writeData(dirs, file, value) {
  const text = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(path.join(dirs.data, file), text);
}

/** Starts the app. Returns { url, dirs, logger, request, stop }. */
export async function startServer({ dirs, logger = memoryLogger() } = {}) {
  dirs ??= await makeDirs();
  const site = await createApp({ paths: dirs, trustProxy: 'loopback' }, { logger });
  const server = await new Promise((resolve) => {
    const s = site.app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const url = `http://127.0.0.1:${server.address().port}`;

  const request = async (pathname, { method = 'GET', json, headers = {}, body } = {}) => {
    const res = await fetch(url + pathname, {
      method,
      headers: json !== undefined ? { 'content-type': 'application/json', ...headers } : headers,
      body: json !== undefined ? JSON.stringify(json) : body,
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: res.status, headers: res.headers, text, data };
  };

  const stop = async () => {
    await new Promise((resolve) => server.close(resolve));
    await site.close();
  };

  return { url, dirs, logger, request, stop };
}
