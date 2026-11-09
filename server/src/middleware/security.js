import helmet from 'helmet';

// Analytics hosts (client/public/analytics.js): Google Tag Manager running GA4, and Microsoft
// Clarity. From Google's "Use Tag Manager with a Content Security Policy" guide and Microsoft's
// Clarity CSP note. Images need nothing extra: img-src already allows any https image.
const ANALYTICS_SCRIPTS = [
  'https://www.googletagmanager.com',
  'https://tagmanager.google.com', // Tag Manager's Preview / Tag Assistant mode
  'https://*.clarity.ms',
];
const ANALYTICS_CONNECT = [
  'https://www.googletagmanager.com',
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
  'https://*.google.com',
  'https://*.g.doubleclick.net',
  'https://*.clarity.ms',
  'https://c.bing.com',
];

/**
 * Security headers. Scripts may only come from files: this site's own, plus the analytics hosts
 * above. Inline <script> blocks never run (paste-in snippets belong in a file). Images may come
 * from https links too.
 */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", ...ANALYTICS_SCRIPTS],
        'connect-src': ["'self'", ...ANALYTICS_CONNECT],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'frame-ancestors': ["'self'"],
        // The site may be served over plain http (e.g. on a private network): never force https.
        'upgrade-insecure-requests': null,
      },
    },
    strictTransportSecurity: false,
    crossOriginEmbedderPolicy: false,
  });
}
