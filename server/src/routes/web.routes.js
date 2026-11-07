// The website itself: the built React app (client/dist) and your files in server/public.
import fs from 'node:fs/promises';
import path from 'node:path';
import express, { Router } from 'express';
import { NOT_FOUND_PAGE, renderIndexHtml } from '../utils/html.js';

export function webRoutes({ distDir, publicDir, content }) {
  const router = Router();
  const indexFile = path.join(distDir, 'index.html');
  let cached = { key: '', html: '' };

  // index.html with the meta tags from site.json. Re-rendered only when the build
  // or the content changes, so `npm run build` takes effect without a restart.
  async function indexPage() {
    const stat = await fs.stat(indexFile).catch(() => null);
    if (!stat) return null;
    const key = `${stat.mtimeMs}:${stat.size}:${await content.version()}`;
    if (cached.key !== key) {
      const [template, site] = await Promise.all([fs.readFile(indexFile, 'utf8'), content.getSection('site')]);
      cached = { key, html: renderIndexHtml(template, site.meta) };
    }
    return cached.html;
  }

  router.get(['/', '/index.html'], async (req, res) => {
    const html = await indexPage();
    if (!html) return res.status(503).type('text').send('The site has not been built yet.\n\nRun:  npm run build');
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  });

  // Hashed build files never change, so browsers may keep them for a year.
  router.use('/assets', express.static(path.join(distDir, 'assets'), { immutable: true, maxAge: '1y', index: false, fallthrough: false }));
  router.use(express.static(distDir, { index: false, maxAge: '1h' }));
  router.use(express.static(publicDir, { index: false, maxAge: '1h', dotfiles: 'ignore' }));

  router.use((req, res) => res.status(404).type('html').send(NOT_FOUND_PAGE));
  return router;
}
