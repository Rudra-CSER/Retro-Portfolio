// PIXEL CUP leaderboard entries.
// Points are always computed here from the match result; the browser never sends them.

export const MAX_GOALS = 30;

/** GOAL 100 · MARGIN 50 · WIN 150 · DRAW 50 (the rules printed under the leaderboard) */
export function pointsFor(gf, ga) {
  const win = gf > ga;
  const draw = gf === ga;
  return gf * 100 + Math.max(0, gf - ga) * 50 + (win ? 150 : draw ? 50 : 0);
}

const isGoals = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_GOALS;

/** Validates a POST /api/scores body → { value } or { errors: { field: message } } */
export function validateScoreInput(body) {
  const b = body && typeof body === 'object' ? body : {};
  const initials = typeof b.initials === 'string' ? b.initials.trim().toUpperCase() : '';
  const gf = Number(b.gf);
  const ga = Number(b.ga);

  const errors = {};
  if (!/^[A-Z0-9]{3}$/.test(initials)) errors.initials = 'Use exactly three letters or digits.';
  if (!isGoals(gf)) errors.gf = `Goals for must be a whole number from 0 to ${MAX_GOALS}.`;
  if (!isGoals(ga)) errors.ga = `Goals against must be a whole number from 0 to ${MAX_GOALS}.`;
  return Object.keys(errors).length ? { errors } : { value: { initials, gf, ga } };
}

/** Highest points first; on a tie, whoever got there first stays ahead. */
export const byRank = (a, b) => b.points - a.points || a.createdAt.localeCompare(b.createdAt);

/** Keeps only well-formed entries from storage/scores.json (it may have been edited by hand). */
export function sanitizeStoredScores(value) {
  if (!Array.isArray(value)) throw new Error('expected a list of scores');
  return value
    .filter(
      (s) =>
        s &&
        typeof s.initials === 'string' &&
        /^[A-Z0-9]{3}$/.test(s.initials) &&
        isGoals(s.gf) &&
        isGoals(s.ga) &&
        typeof s.createdAt === 'string' &&
        !Number.isNaN(Date.parse(s.createdAt)),
    )
    .map(({ initials, gf, ga, createdAt }) => ({ initials, gf, ga, points: pointsFor(gf, ga), createdAt }))
    .sort(byRank);
}

/** What the API shows for each entry. */
export const toPublicScore = ({ initials, gf, ga, points, createdAt }) => ({ initials, gf, ga, points, createdAt });
