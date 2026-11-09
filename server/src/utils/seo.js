// Search-engine files made from server/data. The Cloudflare build (cloudflare/build.js) writes them
// into build/, and the Express server (routes/web.routes.js) can serve the same ones locally.
//   robots.txt · sitemap.xml · the JSON-LD <script> that goes into index.html

/** "https://rudramondal.dev" → "https://rudramondal.dev/" */
const home = (siteUrl) => `${String(siteUrl || '').replace(/\/+$/, '')}/`;
const xmlEscape = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
const isLink = (v) => /^https?:\/\//.test(v);

/** robots.txt: crawlers may fetch everything, including /api/content, which the page needs to render. */
export function robotsTxt(siteUrl) {
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${home(siteUrl)}sitemap.xml`, ''].join('\n');
}

/** sitemap.xml: the one page this site has. lastmod = the day its content last changed (YYYY-MM-DD). */
export function sitemapXml(siteUrl, lastmod) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${xmlEscape(home(siteUrl))}</loc>`,
    ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
    '  </url>',
    '</urlset>',
    '',
  ].join('\n');
}

/** JSON-LD for index.html: a profile page about one person. c = the merged content (all five JSON files). */
export function jsonLdTag(c) {
  const url = home(c.meta.siteUrl);
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${url}#website`, url, name: c.person.name, alternateName: 'RUDRA.ROM' },
      {
        '@type': 'ProfilePage',
        '@id': `${url}#profile`,
        url,
        name: c.meta.title,
        isPartOf: { '@id': `${url}#website` },
        mainEntity: {
          '@type': 'Person',
          '@id': `${url}#person`,
          name: c.person.name,
          alternateName: 'Rudra Mondal',
          url,
          ...(c.meta.shareImage ? { image: new URL(c.meta.shareImage, url).href } : {}),
          jobTitle: c.person.role,
          worksFor: { '@type': 'Organization', name: c.person.org },
          description: c.about.short,
          sameAs: Object.entries(c.person.links)
            .filter(([key, v]) => key !== 'resume' && isLink(v))
            .map(([, v]) => v),
        },
      },
    ],
  };
  // "<" is escaped so nothing in the data can close the <script> tag early.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}
