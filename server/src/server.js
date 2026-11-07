// Entry point:  npm start  (or  npm run dev  for auto-restart on code changes)
import os from 'node:os';
import { createApp } from './app.js';
import { config } from './config.js';
import { ContentError } from './services/content.service.js';

let site;
try {
  site = await createApp(config);
} catch (err) {
  if (err instanceof ContentError) {
    console.error(`\n${err.report()}\n\nFix the files above (or run \`npm run check\`), then start again.\n`);
    process.exit(1);
  }
  throw err;
}

const server = site.app.listen(config.port, config.host, () => {
  console.log('\n  ▶ RUDRA.ROM is live');
  for (const url of localUrls()) console.log(`    ${url}`);
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`Port ${config.port} is already in use. Stop the other server or start with PORT=5001.`);
  else console.error(err);
  process.exit(1);
});

function localUrls() {
  const urls = [`http://localhost:${config.port}`];
  if (config.host !== '0.0.0.0' && config.host !== '::') return urls;
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (name.startsWith('docker') || name.startsWith('br-')) continue;
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      urls.push(`http://${a.address}:${config.port}`);
    }
  }
  return urls;
}

// Finish in-flight requests and pending writes, then exit. Forced after 5 s.
let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`\n[${signal}] shutting down…`);
  setTimeout(() => process.exit(1), 5000).unref();
  server.close(() => {
    site.close().finally(() => process.exit(0));
  });
  server.closeIdleConnections?.();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// A bug we didn't catch: log it and exit, so pm2/systemd restarts a clean process.
process.on('unhandledRejection', (err) => {
  console.error('[fatal] unhandled promise rejection:', err);
  process.exit(1);
});
