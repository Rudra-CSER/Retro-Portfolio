import { config } from './env.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createStore } from './store/index.js';
import { validateMessage, validateScore } from './validate.js';

const store = await createStore({
  mongoUri: config.mongoUri,
  contentPath: config.paths.content,
  storageDir: config.paths.storage,
});

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // The site is served over plain http on the tailnet until a domain is set,
        // so never force-upgrade sub-resources to https.
        'upgrade-insecure-requests': null,
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'"],
        'script-src': ["'self'"],
        'frame-ancestors': ["'self'"],
      },
    },
    strictTransportSecurity: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(compression());
app.use(express.json({ limit: '24kb' }));

// ── API ────────────────────────────────────────────────────────────────────
const api = express.Router();
const limiter = (windowMin, max, message) =>
  rateLimit({ windowMs: windowMin * 60_000, limit: max, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: message } });

const resumePath = path.join(config.paths.public, 'resume.pdf');

function hostInfo() {
  const cpus = os.cpus();
  return {
    label: config.hostLabel,
    cpu: (cpus[0]?.model || 'UNKNOWN CPU').replace(/\s+/g, ' ').replace(/\s*with Radeon Graphics/i, '').trim(),
    threads: cpus.length,
  };
}

api.get('/health', (req, res) => {
  res.json({ ok: true, host: hostInfo() });
});

api.get('/content', async (req, res, next) => {
  try {
    const content = await store.getContent();
    res.set('Cache-Control', 'no-cache');
    res.json({ ...content, resumeAvailable: fs.existsSync(resumePath) });
  } catch (err) {
    next(err);
  }
});

api.post('/contact', limiter(15, 6, 'Too many messages — try again in a few minutes.'), async (req, res, next) => {
  try {
    const result = validateMessage(req.body);
    if (result.spam) return res.status(201).json({ ok: true });
    if (result.errors) return res.status(400).json({ error: 'Check the form.', fields: result.errors });
    await store.addMessage({ ...result.value, ip: req.ip, ua: String(req.get('user-agent') || '').slice(0, 200) });
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

api.get('/scores', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-cache');
    res.json({ scores: await store.topScores(10) });
  } catch (err) {
    next(err);
  }
});

api.post('/scores', limiter(10, 20, 'Slow down, striker.'), async (req, res, next) => {
  try {
    const result = validateScore(req.body);
    if (result.errors) return res.status(400).json({ error: 'Invalid score.', fields: result.errors });
    const { rank } = await store.addScore(result.value);
    res.status(201).json({ ok: true, rank, points: result.value.points, scores: await store.topScores(10) });
  } catch (err) {
    next(err);
  }
});

api.post('/visits', limiter(60, 30, 'Easy.'), async (req, res, next) => {
  try {
    res.json({ count: await store.incrementVisits() });
  } catch (err) {
    next(err);
  }
});

api.get('/visits', async (req, res, next) => {
  try {
    res.json({ count: await store.getVisits() });
  } catch (err) {
    next(err);
  }
});

api.get('/admin/messages', async (req, res, next) => {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!config.adminToken || token !== config.adminToken) return res.status(401).json({ error: 'Unauthorized' });
  try {
    res.json({ messages: await store.listMessages(Math.min(500, Number(req.query.limit) || 100)) });
  } catch (err) {
    next(err);
  }
});

api.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use('/api', api);

// ── Static: resume + other drop-in files ───────────────────────────────────
app.use(express.static(config.paths.public, { index: false, maxAge: '1h', dotfiles: 'ignore' }));

// ── Client build ───────────────────────────────────────────────────────────
const indexFile = path.join(config.paths.dist, 'index.html');
let indexHtml = null;
if (fs.existsSync(indexFile)) {
  indexHtml = fs.readFileSync(indexFile, 'utf8').replaceAll('__SITE_URL__', config.siteUrl);
  app.use('/assets', express.static(path.join(config.paths.dist, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  app.use(express.static(config.paths.dist, { index: false, maxAge: '1h' }));
}

app.get(['/', '/index.html'], (req, res) => {
  if (!indexHtml) {
    return res
      .status(503)
      .type('text')
      .send('Client not built yet.\n\nRun:  npm run build   then restart the server.');
  }
  res.set('Cache-Control', 'no-cache').type('html').send(indexHtml);
});

// Retro 404 for anything else.
app.use((req, res) => {
  res
    .status(404)
    .type('html')
    .send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 · Stage not found</title>
<style>html,body{height:100%;margin:0;background:#050505;color:#F2EEE6;font:20px/1.4 ui-monospace,monospace;display:grid;place-items:center;text-align:center}
b{color:#FFB627;font-size:64px;letter-spacing:.1em}a{color:#FFB627}p{opacity:.7;letter-spacing:.2em}</style>
<div><b>404</b><p>STAGE NOT FOUND · GAME OVER?</p><a href="/">▶ CONTINUE</a></div>`);
});

app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad JSON' });
  if (err?.status === 404) return res.status(404).end();
  console.error('[error]', err);
  res.status(500).json({ error: 'Server error' });
});

const server = app.listen(config.port, config.host, () => {
  const urls = [`http://localhost:${config.port}`];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      const tag = a.address.startsWith('100.') ? '  ← tailnet' : name.startsWith('docker') || name.startsWith('br-') ? null : '';
      if (tag !== null) urls.push(`http://${a.address}:${config.port}${tag}`);
    }
  }
  console.log(`\n  ▶ RUDRA.ROM is live  (${store.mode} mode)`);
  for (const u of urls) console.log(`    ${u}`);
  if (config.siteUrl) console.log(`    SITE_URL → ${config.siteUrl}`);
  if (!indexHtml) console.log('    (client not built — run `npm run build`)');
  console.log('');
});

async function shutdown(signal) {
  console.log(`\n[${signal}] shutting down…`);
  server.close();
  await store.close().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
