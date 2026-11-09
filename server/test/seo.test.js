import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { renderIndexHtml } from '../src/utils/html.js';
import { jsonLdTag, llmsTxt, robotsTxt, sitemapXml } from '../src/utils/seo.js';

const content = {
  meta: {
    title: 'Title',
    description: 'Description',
    shareTitle: 'Share title',
    shareDescription: 'Share description',
    shareImage: '/og.png',
    shareImageAlt: 'Share image',
    siteUrl: 'https://example.dev/',
  },
  person: { name: 'Ada Lovelace', role: 'Engineer', org: 'Lab', links: { github: 'https://github.com/ada', linkedin: '', resume: '/resume.pdf' } },
  about: { short: 'Short bio </script><b>' },
};
const template =
  '<html><head><title>x</title><meta name="description" content="x" /><meta property="og:title" content="x" />' +
  '<meta property="og:description" content="x" /></head><body></body></html>';

describe('search-engine files', () => {
  test('robots.txt allows everything (the page needs /api/content to render) and names the sitemap', () => {
    const txt = robotsTxt('https://example.dev/');
    assert.match(txt, /^User-agent: \*\nAllow: \/\n/);
    assert.doesNotMatch(txt, /Disallow/);
    assert.match(txt, /\nSitemap: https:\/\/example\.dev\/sitemap\.xml\n$/);
  });

  test('sitemap.xml lists the home page as a full URL, with lastmod only when it is known', () => {
    assert.match(sitemapXml('https://example.dev', '2026-11-10'), /<loc>https:\/\/example\.dev\/<\/loc>\s*<lastmod>2026-11-10<\/lastmod>/);
    assert.doesNotMatch(sitemapXml('https://example.dev'), /lastmod/);
  });

  test('index.html gets full share-image URLs and JSON-LD that cannot close its <script> early', () => {
    const html = renderIndexHtml(template, content.meta, { jsonLd: jsonLdTag(content) });
    assert.match(html, /<link rel="canonical" href="https:\/\/example\.dev\/" \/>/);
    assert.match(html, /<meta property="og:image" content="https:\/\/example\.dev\/og\.png" \/>/);
    assert.match(html, /<meta name="twitter:image" content="https:\/\/example\.dev\/og\.png" \/>/);

    const [, json] = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    assert.doesNotMatch(json, /<\/script>/);
    const person = JSON.parse(json)['@graph'][1].mainEntity;
    assert.equal(person.name, 'Ada Lovelace');
    assert.equal(person.image, 'https://example.dev/og.png');
    assert.deepEqual(person.sameAs, ['https://github.com/ada']);
    assert.equal(person.description, 'Short bio </script><b>');
  });

  test('llms.txt sums up the site in Markdown, with full links and no empty ones', () => {
    const txt = llmsTxt({
      ...content,
      person: { ...content.person, email: 'ada@example.dev' },
      about: { ...content.about, paragraph: 'I build engines.' },
      projects: [
        { name: 'Engine', title: 'Analytical engine.', description: 'Punched cards.', liveUrl: 'https://engine.example', sourceUrl: '' },
        { name: 'Notes', title: 'Notes on the engine.', description: 'The first program.', liveUrl: '', sourceUrl: '' },
      ],
      hallOfFame: [{ title: 'First programmer', detail: 'Note G', score: '1843' }],
    });
    assert.match(txt, /^# Ada Lovelace\n\n> Description\n\nI build engines\.\n\n## Projects\n/);
    assert.match(txt, /\n- \[Engine\]\(https:\/\/engine\.example\): Analytical engine\. Punched cards\.\n/);
    assert.match(txt, /\n- Notes: Notes on the engine\. The first program\.\n/);
    assert.match(txt, /\n- First programmer, Note G \(1843\)\n/);
    assert.match(txt, /\n- \[Website\]\(https:\/\/example\.dev\/\)\n- \[GitHub\]\(https:\/\/github\.com\/ada\)\n/);
    assert.match(txt, /\n- \[Resume\]\(https:\/\/example\.dev\/resume\.pdf\)\n/);
    assert.doesNotMatch(txt, /LinkedIn/);
    assert.match(txt, /\n- Email: ada@example\.dev\n$/);
  });
});
