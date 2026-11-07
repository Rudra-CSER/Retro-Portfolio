// Server settings. Everything has a working default, so there is no .env file.
// PORT, HOST and TRUST_PROXY can still be set by pm2/systemd if you ever need to.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_DIR = path.resolve(SERVER_DIR, '..');

function port(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}

// Express "trust proxy": "loopback" is right when a proxy or tunnel (nginx, …) runs on
// the same machine. "true"/"false" and hop counts are accepted too.
function trustProxy(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export const config = Object.freeze({
  port: port(process.env.PORT, 5000),
  host: process.env.HOST || '0.0.0.0', // 0.0.0.0 = reachable from other devices on the network
  trustProxy: trustProxy(process.env.TRUST_PROXY || 'loopback'),
  paths: Object.freeze({
    data: path.join(SERVER_DIR, 'data'), // the JSON folder: all site content
    public: path.join(SERVER_DIR, 'public'), // resume.pdf, project screenshots
    storage: path.join(SERVER_DIR, 'storage'), // leaderboard + visitor counter (written by the server)
    dist: path.join(ROOT_DIR, 'client', 'dist'), // the built React app
  }),
});
