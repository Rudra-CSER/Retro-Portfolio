// A tiny, dependency-free schema checker.
// A check is a function (value, path, report) that records problems instead of throwing,
// so one run lists every mistake in a file at once.
//   report.error(path, message)   → the file is rejected
//   report.warn(path, message)    → printed, but the file is still used

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Text. Empty text is an error unless `empty: true`. */
export const text = ({ empty = false, check } = {}) =>
  (value, path, report) => {
    if (typeof value !== 'string') return report.error(path, value === undefined ? 'is missing' : 'must be text');
    if (!empty && value.trim() === '') return report.error(path, 'must not be empty');
    if (check && value !== '') {
      const problem = check(value);
      if (problem) report.error(path, problem);
    }
  };

/** A key that may be left out entirely. */
export const optional = (check) => (value, path, report) => {
  if (value !== undefined) check(value, path, report);
};

/** A list of items that all pass `item`. */
export const list = (item, { min = 0, exactly, uniqueBy } = {}) =>
  (value, path, report) => {
    if (!Array.isArray(value)) return report.error(path, value === undefined ? 'is missing' : 'must be a list');
    if (exactly !== undefined && value.length !== exactly) report.error(path, `must have exactly ${exactly} items (has ${value.length})`);
    else if (value.length < min) report.error(path, `needs at least ${min} item${min === 1 ? '' : 's'}`);
    value.forEach((v, i) => item(v, `${path}[${i}]`, report));
    if (uniqueBy) {
      const seen = new Set();
      value.forEach((v, i) => {
        const key = isPlainObject(v) ? v[uniqueBy] : undefined;
        if (key === undefined) return;
        if (seen.has(key)) report.error(`${path}[${i}].${uniqueBy}`, `"${key}" is used twice; it must be unique`);
        seen.add(key);
      });
    }
  };

/** An object with known keys. Unknown keys are reported as warnings (usually a typo). */
export const shape = (fields) => (value, path, report) => {
  if (!isPlainObject(value)) return report.error(path || '(file)', value === undefined ? 'is missing' : 'must be an object');
  for (const [key, check] of Object.entries(fields)) check(value[key], path ? `${path}.${key}` : key, report);
  for (const key of Object.keys(value)) {
    if (!(key in fields)) report.warn(path ? `${path}.${key}` : key, 'is not used by the site (typo?)');
  }
};

// ── common value checks ────────────────────────────────────────────────────
export const isHttpUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

export const url = (opts = {}) => text({ ...opts, check: (v) => (isHttpUrl(v) ? null : 'must be a full http(s):// link') });

/** A link that may also point at a file served by this site, e.g. "/resume.pdf". */
export const siteLink = (opts = {}) =>
  text({
    ...opts,
    check: (v) => (isHttpUrl(v) || /^\/(?!\/)\S*$/.test(v) ? null : 'must be a full http(s):// link or a site path like "/resume.pdf"'),
  });

export const email = (opts = {}) =>
  text({ ...opts, check: (v) => (/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(v) ? null : 'must be an email address') });

export const color = () => text({ check: (v) => (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? null : 'must be a hex colour like "#0B1611"') });

export const slug = () => text({ check: (v) => (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) ? null : 'must be lowercase letters, digits and dashes') });

export const timezone = () =>
  text({
    check: (v) => {
      try {
        new Intl.DateTimeFormat('en-GB', { timeZone: v });
        return null;
      } catch {
        return 'must be an IANA time zone like "Asia/Kolkata"';
      }
    },
  });

/** Runs a check and returns { errors: [], warnings: [] } as "path: message" strings. */
export function validate(check, value) {
  const errors = [];
  const warnings = [];
  check(value, '', {
    error: (path, msg) => errors.push(`${path || '(file)'} ${msg}`),
    warn: (path, msg) => warnings.push(`${path || '(file)'} ${msg}`),
  });
  return { errors, warnings };
}
