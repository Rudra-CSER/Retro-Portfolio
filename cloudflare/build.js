// Builds the Cloudflare version of the site into build/ (git ignores it):
//   build/cloudflare/        static files Cloudflare serves: the React build, server/public, a 404 page, _headers
//   build/worker-data.json   what the API Worker serves under /api/content
//
//   npm run build:cloudflare      (Cloudflare runs this on every push to GitHub)
//
// It reuses the Express server's own code, so both versions behave the same: the content is
// checked against the same model, index.html gets the same title and share tags, and the same
// security headers apply. If server/data has a mistake, the build stops with the list of problems
// and Cloudflare keeps serving the last version that built.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config } from '../server/src/config.js';
import { securityHeaders } from '../server/src/middleware/security.js';
import { ContentError, createContentService } from '../server/src/services/content.service.js';
import { NOT_FOUND_PAGE, renderIndexHtml } from '../server/src/utils/html.js';
import { jsonLdTag, llmsTxt, robotsTxt, sitemapXml } from '../server/src/utils/seo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'build');
const SITE = path.join(OUT, 'cloudflare');
const PLACEHOLDER_DB_ID = 'PASTE-YOUR-D1-DATABASE-ID-HERE';

/**
 * Everything the Worker needs, worked out from server/data and the security middleware.
 * Throws a ContentError if the content has problems.
 * → { content, sections, etag, headers, warnings }
 */
export async function siteData({ dataDir = config.paths.data, publicDir = config.paths.public } = {}) {
  const quiet = { log() {}, warn() {}, error() {} };
  const service = createContentService({ dataDir, publicDir, logger: quiet });
  const { warnings } = await service.load();

  const content = await service.getContent(); // with the same "is resume.pdf really there?" checks
  const sections = {};
  for (const name of service.sectionNames()) sections[name] = await service.getSection(name);

  const etag = `"${createHash('sha256').update(JSON.stringify(content)).digest('base64url').slice(0, 22)}"`;
  return { content, sections, etag, headers: await helmetHeaders(), warnings };
}

/** The exact headers the Express server sends (middleware/security.js), captured without a server. */
function helmetHeaders() {
  return new Promise((resolve, reject) => {
    const headers = {};
    const res = {
      setHeader: (name, value) => {
        headers[name] = String(value);
      },
      removeHeader: (name) => {
        delete headers[name];
      },
    };
    securityHeaders()({ method: 'GET', headers: {} }, res, (err) => (err ? reject(err) : resolve(headers)));
  });
}

/** _headers: security headers on every static file, a long cache for the hashed build files, UTF-8 for llms.txt. */
function headersFile(headers) {
  const lines = ['# Made by cloudflare/build.js from server/src/middleware/security.js. Edit that file, not this one.', '/*'];
  for (const [name, value] of Object.entries(headers)) lines.push(`  ${name}: ${value}`);
  lines.push('', '/assets/*', '  Cache-Control: public, max-age=31536000, immutable');
  // Cloudflare sends .txt files as "text/plain" with no charset, so some readers would decode
  // llms.txt's dashes and arrows as Windows-1252 ("â€”" instead of "—").
  lines.push('', '/llms.txt', '  Content-Type: text/plain; charset=utf-8', '');
  return lines.join('\n');
}

/** The day the content or the page code last changed in git (YYYY-MM-DD): the sitemap's lastmod. */
function lastChanged() {
  try {
    const day = execFileSync('git', ['log', '-1', '--format=%cs', '--', 'server/data', 'client/src', 'client/index.html'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (day) return day;
  } catch {
    // not a git checkout: use today
  }
  return new Date().toISOString().slice(0, 10);
}

function fail(message) {
  console.error(`\n${message.startsWith('✖') ? '' : '✖ '}${message}\n`);
  process.exit(1);
}

async function main() {
  // On Cloudflare's build machines: catch a forgotten database ID with a readable message.
  if (process.env.WORKERS_CI) {
    const wrangler = await fs.readFile(path.join(ROOT, 'wrangler.jsonc'), 'utf8');
    if (wrangler.includes(PLACEHOLDER_DB_ID)) {
      fail('wrangler.jsonc still has the placeholder database_id. Create the D1 database in the Cloudflare dashboard, paste its ID into wrangler.jsonc, then commit and push.');
    }
  }

  const template = await fs.readFile(path.join(config.paths.dist, 'index.html'), 'utf8').catch(() => null);
  if (!template) fail('client/dist/index.html is missing. Run `npm run build:cloudflare` (it builds the React app first).');

  let data;
  try {
    data = await siteData();
  } catch (err) {
    if (!(err instanceof ContentError)) throw err;
    fail(`${err.report()}\n\nFix the files above (npm run check lists them too), then build again.`);
  }
  for (const w of data.warnings) console.warn(`  ⚠ ${w}`);

  // server/public first, then the React build on top: the same precedence as the Express server.
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(SITE, { recursive: true });
  await fs.cp(config.paths.public, SITE, { recursive: true, filter: (src) => !path.basename(src).startsWith('.') }).catch((err) => {
    if (err.code !== 'ENOENT') throw err;
  });
  await fs.cp(config.paths.dist, SITE, { recursive: true });

  const { meta } = data.sections.site;
  const jsonLd = meta.siteUrl ? jsonLdTag(data.content) : '';
  await fs.writeFile(path.join(SITE, 'index.html'), renderIndexHtml(template, meta, { jsonLd }));
  await fs.writeFile(path.join(SITE, '404.html'), NOT_FOUND_PAGE);
  await fs.writeFile(path.join(SITE, '_headers'), headersFile(data.headers));

  // Files for search engines and AI tools. They need the site's full https:// address.
  if (meta.siteUrl) {
    await fs.writeFile(path.join(SITE, 'robots.txt'), robotsTxt(meta.siteUrl));
    await fs.writeFile(path.join(SITE, 'sitemap.xml'), sitemapXml(meta.siteUrl, lastChanged()));
    await fs.writeFile(path.join(SITE, 'llms.txt'), llmsTxt(data.content));
  }

  const { content, sections, etag, headers } = data;
  await fs.writeFile(path.join(OUT, 'worker-data.json'), JSON.stringify({ content, sections, etag, headers }));

  console.log(`✔ Cloudflare build ready in build/ (site url: ${data.sections.site.meta.siteUrl || 'not set'})`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
