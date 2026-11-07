// Print the latest contact-form messages, newest first.
//   npm run messages            (20 most recent)
//   npm run messages -- 100     (100 most recent)
import { config } from './env.js';
import { createStore } from './store/index.js';

const limit = Math.max(1, Math.min(1000, Number(process.argv[2]) || 20));
const quiet = { log() {}, warn: console.warn };
const store = await createStore({
  mongoUri: config.mongoUri,
  contentPath: config.paths.content,
  storageDir: config.paths.storage,
  log: quiet,
});

const list = await store.listMessages(limit);
if (!list.length) {
  console.log(`No messages yet (${store.mode} mode).`);
} else {
  console.log(`\n${list.length} message(s) · ${store.mode} mode\n${'─'.repeat(60)}`);
  for (const m of list) {
    const when = new Date(m.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    console.log(`${when}  ${m.name ? `${m.name} ` : ''}<${m.email}>`);
    console.log(`  ${m.message.replace(/\n/g, '\n  ')}`);
    console.log('─'.repeat(60));
  }
}
await store.close();
process.exit(0);
