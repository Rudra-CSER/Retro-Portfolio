// Search-engine files made from server/data. The Cloudflare build (cloudflare/build.js) writes them
// into build/, and the Express server (routes/web.routes.js) serves the same ones.
//   robots.txt · sitemap.xml · llms.txt · the JSON-LD <script> and the <noscript> page in index.html

/** "https://rudramondal.dev" → "https://rudramondal.dev/" */
const home = (siteUrl) => `${String(siteUrl || '').replace(/\/+$/, '')}/`;
const xmlEscape = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
const htmlEscape = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' })[c]);
const isLink = (v) => /^https?:\/\//.test(v);
const LABELS = { github: 'GitHub', linkedin: 'LinkedIn', x: 'X', resume: 'Resume' };

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

/**
 * llms.txt (llmstxt.org): a plain Markdown summary of the site for AI tools that look for one.
 * Google Search ignores it; it is built from the same JSON as the page, so it never goes stale.
 */
export function llmsTxt(c) {
  const url = home(c.meta.siteUrl);
  const project = (p) => {
    const link = p.liveUrl || p.sourceUrl;
    return `- ${link ? `[${p.name}](${link})` : p.name}: ${p.title} ${p.description}`;
  };
  const links = Object.entries(c.person.links)
    .filter(([, v]) => v && (isLink(v) || v.startsWith('/')))
    .map(([key, v]) => `- [${LABELS[key] ?? key}](${new URL(v, url).href})`);
  return [
    `# ${c.person.name}`,
    '',
    `> ${c.meta.description}`,
    '',
    c.about.paragraph,
    '',
    '## Projects',
    '',
    ...c.projects.map(project),
    '',
    '## Experience and awards',
    '',
    ...c.hallOfFame.map((h) => `- ${h.title}, ${h.detail} (${h.score})`),
    '',
    '## Contact',
    '',
    `- [Website](${url})`,
    ...links,
    `- Email: ${c.person.email}`,
    '',
  ].join('\n');
}

/**
 * The page as plain HTML, for the <noscript> block in index.html: what visitors and crawlers that don't
 * run JavaScript see (most AI search crawlers, for one). The same words as the site, from server/data.
 * Google runs the JavaScript, so it reads the real page instead.
 */
export function noscriptHtml(c) {
  const link = (href, text) => `<a style="color:#FFB627" href="${htmlEscape(href)}">${htmlEscape(text)}</a>`;
  const projects = c.projects.map((p) => {
    const href = [p.liveUrl, p.sourceUrl].find(isLink);
    return `<li>${href ? link(href, p.name) : htmlEscape(p.name)}: ${htmlEscape(p.title)} ${htmlEscape(p.description)}</li>`;
  });
  const awards = c.hallOfFame.map((h) => `<li>${htmlEscape(`${h.title}, ${h.detail} (${h.score})`)}</li>`);
  const contact = [
    ...(c.person.email ? [`<li>${link(`mailto:${c.person.email}`, c.person.email)}</li>`] : []),
    ...Object.entries(c.person.links)
      .filter(([, v]) => v && (isLink(v) || v.startsWith('/')))
      .map(([key, v]) => `<li>${link(v, LABELS[key] ?? key)}</li>`),
  ];
  return [
    '<p>RUDRA.ROM needs JavaScript to boot. This is the plain version.</p>',
    `<h1>${htmlEscape(c.person.name)}</h1>`,
    `<p>${htmlEscape(`${c.person.role} · ${c.person.org}`)}</p>`,
    `<p>${htmlEscape(c.about.paragraph)}</p>`,
    '<h2>Projects</h2>',
    `<ul>${projects.join('')}</ul>`,
    '<h2>Experience and awards</h2>',
    `<ul>${awards.join('')}</ul>`,
    '<h2>Contact</h2>',
    `<ul>${contact.join('')}</ul>`,
  ].join('\n');
}
