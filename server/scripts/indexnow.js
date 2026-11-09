// Tells Bing and the other IndexNow search engines (Yandex, Seznam, Naver, Yep) that the site changed,
// so they recrawl it now instead of whenever they next pass by. Bing's results also appear on Yahoo
// and DuckDuckGo. Google doesn't use IndexNow: for Google, use Search Console → URL Inspection →
// Request indexing.
//   npm run indexnow      after a push that changed the content, once Cloudflare has deployed it
//
// The key is the name of server/public/<key>.txt (the file holds the same text). It is served at
// https://<your site>/<key>.txt, which is how the search engines check that the ping comes from the
// site's owner. A new key: 32 hex characters, e.g. from `openssl rand -hex 16`.
import fs from 'node:fs/promises';
import { config } from '../src/config.js';
import { ContentError, createContentService } from '../src/services/content.service.js';

const quiet = { log() {}, warn() {}, error() {} };
const content = createContentService({ dataDir: config.paths.data, publicDir: config.paths.public, logger: quiet });

try {
  await content.load();
} catch (err) {
  if (!(err instanceof ContentError)) throw err;
  console.error(err.report());
  process.exit(1);
}
const { siteUrl } = (await content.getContent()).meta;
if (!siteUrl) {
  console.error('✖ site.json → meta.siteUrl is empty: set the site address first.');
  process.exit(1);
}

let key;
for (const name of await fs.readdir(config.paths.public)) {
  const match = /^([0-9a-f]{32})\.txt$/.exec(name);
  if (match && (await fs.readFile(`${config.paths.public}/${name}`, 'utf8')).trim() === match[1]) key = match[1];
}
if (!key) {
  console.error('✖ No IndexNow key: server/public needs a <key>.txt file that contains its own name (32 hex characters).');
  process.exit(1);
}

const home = `${siteUrl.replace(/\/+$/, '')}/`;
let res;
try {
  res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(home).host, key, keyLocation: `${home}${key}.txt`, urlList: [home] }),
  });
} catch (err) {
  console.error(`✖ Couldn't reach api.indexnow.org (${err.cause?.code ?? err.message}). Check the internet connection.`);
  process.exit(1);
}
const why = {
  400: 'the request was malformed',
  403: `the key wasn't found at ${home}${key}.txt (has the deploy finished?)`,
  422: "the URL doesn't belong to this host, or the key doesn't match",
  429: 'too many pings: try again later',
};
if (res.ok) {
  console.log(`✔ IndexNow accepted ${home} (${res.status}). Bing usually recrawls within a day or two.`);
} else {
  console.error(`✖ IndexNow said ${res.status}: ${why[res.status] ?? res.statusText}`);
  process.exit(1);
}
