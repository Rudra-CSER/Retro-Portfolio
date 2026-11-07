// Small, dependency-free validators for the public endpoints.

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

const clean = (v, max) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';

export function validateMessage(body = {}) {
  // Honeypot: real people never see or fill the "company" field.
  if (typeof body.company === 'string' && body.company.trim() !== '') return { spam: true };

  const email = clean(body.email, 200).toLowerCase();
  const name = clean(body.name, 80);
  const message = clean(body.message, 4000);

  const errors = {};
  if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.';
  if (message.length < 2) errors.message = 'Add a short message.';
  return Object.keys(errors).length ? { errors } : { value: { email, name, message } };
}

// Points are computed on the server from the match result, never trusted from the client.
export function scoreFromResult(gf, ga) {
  const win = gf > ga;
  const draw = gf === ga;
  return Math.max(0, gf * 100 + Math.max(0, gf - ga) * 50 + (win ? 150 : draw ? 50 : 0));
}

export function validateScore(body = {}) {
  const initials = clean(body.initials, 3).toUpperCase();
  const gf = Number(body.gf);
  const ga = Number(body.ga);
  const errors = {};
  if (!/^[A-Z0-9]{3}$/.test(initials)) errors.initials = 'Three letters or digits.';
  if (!Number.isInteger(gf) || gf < 0 || gf > 30) errors.gf = 'Invalid goals for.';
  if (!Number.isInteger(ga) || ga < 0 || ga > 30) errors.ga = 'Invalid goals against.';
  if (Object.keys(errors).length) return { errors };
  return { value: { initials, gf, ga, points: scoreFromResult(gf, ga) } };
}
