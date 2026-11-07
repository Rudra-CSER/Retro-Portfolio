// Push server/data/content.json into MongoDB (overwrites site content + projects).
//   npm run seed
// Messages, scores and the visitor counter are left untouched.
import { config } from './env.js';
import { readContentFile } from './store/index.js';

if (!config.mongoUri) {
  console.log('MONGODB_URI is not set — in file mode the site reads data/content.json directly. Nothing to seed.');
  process.exit(0);
}

const { createMongoStore } = await import('./store/mongoStore.js');
try {
  const store = await createMongoStore(config.mongoUri);
  const content = await readContentFile(config.paths.content);
  await store.seed(content, { force: true });
  console.log(`Seeded content + ${content.projects?.length || 0} projects into MongoDB.`);
  await store.close();
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exit(1);
}
