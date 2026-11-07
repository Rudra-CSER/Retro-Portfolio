// The last stop for every request: unknown API paths and errors.

/** Unknown /api/* path → JSON 404 (the website's own 404 page is in routes/web.routes.js). */
export function apiNotFound(req, res) {
  res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl}` });
}

/** Turns any thrown error into a response. Details of real crashes go to the log, never to the visitor. */
export function errorHandler(logger = console) {
  // Express recognises error handlers by their four arguments.
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    let status = Number(err.status || err.statusCode) || 500;
    let message = err.expose || err.name === 'HttpError' ? err.message : 'Something went wrong on the server.';
    if (err.type === 'entity.parse.failed') message = 'The request body must be valid JSON.';
    if (err.type === 'entity.too.large') message = 'The request body is too large.';
    if (status < 400 || status > 599) status = 500;
    if (status >= 500) logger.error(`[error] ${req.method} ${req.originalUrl}\n`, err);

    if (res.headersSent) return res.end();
    if (req.originalUrl.startsWith('/api')) {
      return res.status(status).json({ error: message, ...(err.details || {}) });
    }
    res.status(status).type('text').send(status === 404 ? 'Not found' : message);
  };
}
