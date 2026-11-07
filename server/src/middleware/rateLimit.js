import rateLimit from 'express-rate-limit';

/** At most `limit` requests per IP every `minutes`; then 429 with a JSON { error }. */
export function limitRequests({ minutes, limit, message }) {
  return rateLimit({
    windowMs: minutes * 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: message },
  });
}
