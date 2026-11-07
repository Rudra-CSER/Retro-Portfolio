import helmet from 'helmet';

/** Security headers. Only this site's own scripts may run; images may come from https links too. */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'"],
        'connect-src': ["'self'"],
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
