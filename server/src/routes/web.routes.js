// The website itself: the built React app (client/dist) and your files in server/public.
import fs from 'node:fs/promises';
import path from 'node:path';
import express, { Router } from 'express';
import { NOT_FOUND_PAGE, renderIndexHtml } from '../utils/html.js';
import { jsonLdTag, llmsTxt, noscriptHtml, robotsTxt, sitemapXml } from '../utils/seo.js';

export function webRoutes({ distDir, publicDir, content }) {
  const router = Router();
  const indexFile = path.join(distDir, 'index.html');
  let cached = { key: '', html: '' };

  // index.html with the meta tags from site.json, the plain <noscript> version of the page and, once
  // meta.siteUrl is set, the JSON-LD. Re-rendered only when the build or the content changes, so
  // `npm run build` takes effect without a restart.
  async function indexPage() {
    const stat = await fs.stat(indexFile).catch(() => null);
    if (!stat) return null;
    const key = `${stat.mtimeMs}:${stat.size}:${await content.version()}`;
    if (cached.key !== key) {
      const [template, all] = await Promise.all([fs.readFile(indexFile, 'utf8'), content.getContent()]);
      const jsonLd = all.meta.siteUrl ? jsonLdTag(all) : '';
      cached = { key, html: renderIndexHtml(template, all.meta, { jsonLd, noscript: noscriptHtml(all) }) };
    }
    return cached.html;
  }

  router.get(['/', '/index.html'], async (req, res) => {
    const html = await indexPage();
    if (!html) return res.status(503).type('text').send('The site has not been built yet.\n\nRun:  npm run build');
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  });

  // robots.txt, sitemap.xml and llms.txt: the same files the Cloudflare build writes (utils/seo.js).
  // Like there, they exist only once site.json has meta.siteUrl.
  const seoFile = (type, make) => async (req, res) => {
    const all = await content.getContent();
    if (!all.meta.siteUrl) return res.status(404).type('html').send(NOT_FOUND_PAGE);
    res.set('Cache-Control', 'public, max-age=3600').type(type).send(make(all));
  };
  router.get('/robots.txt', seoFile('text/plain', (all) => robotsTxt(all.meta.siteUrl)));
  router.get('/sitemap.xml', seoFile('application/xml', (all) => sitemapXml(all.meta.siteUrl)));
  router.get('/llms.txt', seoFile('text/plain', (all) => llmsTxt(all)));

  // Hashed build files never change, so browsers may keep them for a year.
  router.use('/assets', express.static(path.join(distDir, 'assets'), { immutable: true, maxAge: '1y', index: false, fallthrough: false }));
  router.use(express.static(distDir, { index: false, maxAge: '1h' }));
  router.use(express.static(publicDir, { index: false, maxAge: '1h', dotfiles: 'ignore' }));

  router.use((req, res) => res.status(404).type('html').send(NOT_FOUND_PAGE));
  return router;
}
