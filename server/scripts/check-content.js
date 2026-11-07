// Checks every file in server/data against the content model.
//   npm run check
// Exit code 0 = all good (warnings are printed but allowed), 1 = something to fix.
import { config } from '../src/config.js';
import { CONTENT_FILES } from '../src/models/content.model.js';
import { ContentError, createContentService } from '../src/services/content.service.js';

const quiet = { log() {}, warn() {}, error() {} };
const content = createContentService({ dataDir: config.paths.data, publicDir: config.paths.public, logger: quiet });

try {
  const { warnings } = await content.load();
  console.log(`✔ server/data is valid (${CONTENT_FILES.join(', ')})`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
} catch (err) {
  if (!(err instanceof ContentError)) throw err;
  console.error(err.report());
  for (const w of err.warnings) console.error(`   ⚠ ${w}`);
  process.exit(1);
}
