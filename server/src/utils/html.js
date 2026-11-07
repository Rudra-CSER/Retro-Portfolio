// Fills the built index.html with the title, description and share tags from site.json,
// so link previews (WhatsApp, LinkedIn, …) always match your content.

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function setTag(html, pattern, value) {
  return html.replace(pattern, (_, before, after) => `${before}${escapeHtml(value)}${after}`);
}

/** meta = site.json → meta: { title, description, shareTitle, shareDescription, siteUrl } */
export function renderIndexHtml(template, meta) {
  let html = template;
  html = setTag(html, /(<title>)[\s\S]*?(<\/title>)/, meta.title);
  html = setTag(html, /(<meta\s+name="description"\s+content=")[^"]*(")/, meta.description);
  html = setTag(html, /(<meta\s+property="og:title"\s+content=")[^"]*(")/, meta.shareTitle);
  html = setTag(html, /(<meta\s+property="og:description"\s+content=")[^"]*(")/, meta.shareDescription);

  const siteUrl = (meta.siteUrl || '').replace(/\/+$/, '');
  if (siteUrl) {
    const url = escapeHtml(`${siteUrl}/`);
    html = html.replace('</head>', `    <link rel="canonical" href="${url}" />\n    <meta property="og:url" content="${url}" />\n  </head>`);
  }
  return html;
}

export const NOT_FOUND_PAGE = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>404 · Stage not found</title>
<style>
  html, body { height: 100%; margin: 0; background: #050505; color: #f2eee6; font: 20px/1.4 ui-monospace, monospace; display: grid; place-items: center; text-align: center; }
  b { color: #e9b250; font-size: 64px; letter-spacing: .1em; }
  a { color: #e9b250; }
  p { opacity: .7; letter-spacing: .2em; }
</style>
<div><b>404</b><p>STAGE NOT FOUND · GAME OVER?</p><a href="/">▶ CONTINUE</a></div>
</html>
`;
