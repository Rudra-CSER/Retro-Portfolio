import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { renderIndexHtml } from '../src/utils/html.js';
import { INDEX_TEMPLATE, makeDirs, readData, startServer, writeData } from './helpers.js';

describe('the website', () => {
  let site;
  before(async () => {
    site = await startServer();
  });
  after(() => site.stop());

  test('index.html gets its title and share tags from site.json', async () => {
    const { meta } = await readData(site.dirs, 'site.json');
    const { status, text, headers } = await site.request('/');
    assert.equal(status, 200);
    assert.match(headers.get('content-type'), /text\/html/);
    assert.ok(text.includes(`<title>${meta.title}</title>`));
    assert.ok(text.includes(`<meta property="og:title" content="${meta.shareTitle}" />`));
    assert.ok(!text.includes('rel="canonical"'), 'no canonical link until siteUrl is set');
  });

  test('setting meta.siteUrl adds canonical + og:url without a restart', async () => {
    const data = await readData(site.dirs, 'site.json');
    data.meta.siteUrl = 'https://rudra.example/';
    await writeData(site.dirs, 'site.json', data);
    const { text } = await site.request('/');
    assert.ok(text.includes('<link rel="canonical" href="https://rudra.example/" />'));
    assert.ok(text.includes('<meta property="og:url" content="https://rudra.example/" />'));
  });

  test('sends security headers', async () => {
    const { headers } = await site.request('/');
    assert.match(headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.equal(headers.get('x-powered-by'), null);
  });

  test('serves files dropped into server/public', async () => {
    await fs.writeFile(path.join(site.dirs.public, 'resume.pdf'), '%PDF-1.4 test');
    const res = await site.request('/resume.pdf');
    assert.equal(res.status, 200);
    assert.equal(res.text, '%PDF-1.4 test');
  });

  test('unknown pages get the retro 404, unknown API routes get JSON', async () => {
    const page = await site.request('/no-such-stage');
    assert.equal(page.status, 404);
    assert.match(page.text, /STAGE NOT FOUND/);
    const api = await site.request('/api/no-such-route');
    assert.equal(api.status, 404);
    assert.match(api.data.error, /No API route/);
    const asset = await site.request('/assets/missing.js');
    assert.equal(asset.status, 404);
  });
});

test('before `npm run build`, the home page says what to do', async () => {
  const site = await startServer({ dirs: await makeDirs({ withIndex: false }) });
  const res = await site.request('/');
  assert.equal(res.status, 503);
  assert.match(res.text, /npm run build/);
  assert.equal((await site.request('/api/health')).data.ok, true);
  await site.stop();
});

test('meta values are HTML-escaped', () => {
  const html = renderIndexHtml(INDEX_TEMPLATE, {
    title: 'A <b>"bold"</b> & title',
    description: 'd',
    shareTitle: 's',
    shareDescription: 'sd',
    siteUrl: '',
  });
  assert.ok(html.includes('<title>A &lt;b&gt;&quot;bold&quot;&lt;/b&gt; &amp; title</title>'));
});
