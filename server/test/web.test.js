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
    const data = await readData(site.dirs, 'site.json');
    data.meta.siteUrl = ''; // the real site.json has the domain; start from "not decided yet"
    await writeData(site.dirs, 'site.json', data);
    const { meta } = data;
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

  test('the security policy lets the analytics in (Tag Manager, GA4, Clarity)', async () => {
    const csp = (await site.request('/')).headers.get('content-security-policy');
    const directive = (name) => csp.split(';').find((d) => d.trim().startsWith(`${name} `)) || '';
    for (const host of ['https://www.googletagmanager.com', 'https://*.clarity.ms']) {
      assert.ok(directive('script-src').includes(host), `script-src allows ${host}`);
    }
    for (const host of ['https://*.google-analytics.com', 'https://*.clarity.ms']) {
      assert.ok(directive('connect-src').includes(host), `connect-src allows ${host}`);
    }
    assert.ok(!directive('script-src').includes("'unsafe-inline'"), 'inline scripts stay blocked');
  });

  test('index.html has no inline <script> (the security policy would block it)', async () => {
    const html = await fs.readFile(new URL('../../client/index.html', import.meta.url), 'utf8');
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(([, attrs, body]) => !/\ssrc=/.test(attrs) && body.trim());
    assert.equal(
      inline.length,
      0,
      'client/index.html has an inline <script>, which the Content Security Policy blocks in the browser. ' +
        'Put it in a file (like client/public/analytics.js) and load that with <script src="/…">.',
    );
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
