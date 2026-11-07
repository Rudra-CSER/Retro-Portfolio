// What visitors create, kept in Cloudflare D1 (SQLite) instead of server/storage/*.json:
// the PIXEL CUP leaderboard, the visitor counter, and recent requests for the rate limits.
// The tables are created on first use, so a new, empty database needs no setup.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS scores (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     initials TEXT NOT NULL,
     gf INTEGER NOT NULL,
     ga INTEGER NOT NULL,
     points INTEGER NOT NULL,
     created_at TEXT NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS scores_by_rank ON scores (points DESC, created_at, id)',
  'CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL)',
  // `who` is a short hash of the visitor's IP address, never the address itself.
  'CREATE TABLE IF NOT EXISTS hits (bucket TEXT NOT NULL, who TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS hits_by_visitor ON hits (bucket, who, at)',
  'CREATE INDEX IF NOT EXISTS hits_by_time ON hits (at)', // so clearing old records doesn't read the whole table
];

// Highest points first; on a tie, whoever got there first stays ahead (models/score.model.js → byRank).
const RANK_ORDER = 'ORDER BY points DESC, created_at, id';

// Rate-limit records older than this are deleted (the longest window in use is 60 minutes).
const KEEP_HITS_MS = 60 * 60_000;

const ready = new WeakMap(); // database → promise that its tables exist

function init(db) {
  if (!ready.has(db)) {
    const p = db.batch(SCHEMA.map((sql) => db.prepare(sql)));
    p.catch(() => ready.delete(db)); // try again on the next request
    ready.set(db, p);
  }
  return ready.get(db);
}

const scoreRow = 'initials, gf, ga, points, created_at AS createdAt';

/** The top `limit` scores, as the API shows them. */
export async function topScores(db, limit) {
  await init(db);
  const { results } = await db.prepare(`SELECT ${scoreRow} FROM scores ${RANK_ORDER} LIMIT ?1`).bind(limit).all();
  return results;
}

/**
 * Saves a result and keeps the best `keep` → { rank, points, scores: top `board` }.
 * rank is the 1-based place on the board, worked out exactly like the Express server does.
 */
export async function addScore(db, { initials, gf, ga, points }, { keep, board }) {
  await init(db);
  const createdAt = new Date().toISOString();
  // One transaction: count who stays ahead, insert, trim the table, read the new top of the board.
  const [ahead, , , top] = await db.batch([
    db.prepare('SELECT COUNT(*) AS n FROM scores WHERE points > ?1 OR (points = ?1 AND created_at <= ?2)').bind(points, createdAt),
    db.prepare('INSERT INTO scores (initials, gf, ga, points, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(initials, gf, ga, points, createdAt),
    db.prepare(`DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ${RANK_ORDER} LIMIT ?1)`).bind(keep),
    db.prepare(`SELECT ${scoreRow} FROM scores ${RANK_ORDER} LIMIT ?1`).bind(board),
  ]);
  return { rank: ahead.results[0].n + 1, points, scores: top.results };
}

/** The visitor count. */
export async function readVisits(db) {
  await init(db);
  const row = await db.prepare("SELECT value FROM counters WHERE name = 'visits'").first();
  return row ? row.value : 0;
}

/** Counts one visit → the new count. */
export async function countVisit(db) {
  await init(db);
  const row = await db
    .prepare("INSERT INTO counters (name, value) VALUES ('visits', 1) ON CONFLICT (name) DO UPDATE SET value = value + 1 RETURNING value")
    .first();
  return row.value;
}

/**
 * Rate limit: true if `who` has made fewer than `limit` requests to `bucket` in the last
 * `minutes`, and records this one. Requests over the limit aren't recorded, so someone
 * hammering the API costs reads only, no writes.
 */
export async function allow(db, bucket, who, { limit, minutes }) {
  await init(db);
  const now = Date.now();
  const [recorded] = await db.batch([
    db
      .prepare(
        `INSERT INTO hits (bucket, who, at)
         SELECT ?1, ?2, ?3
         WHERE (SELECT COUNT(*) FROM hits WHERE bucket = ?1 AND who = ?2 AND at > ?4) < ?5`,
      )
      .bind(bucket, who, now, now - minutes * 60_000, limit),
    db.prepare('DELETE FROM hits WHERE at <= ?1').bind(now - KEEP_HITS_MS),
  ]);
  return recorded.meta.changes === 1;
}
