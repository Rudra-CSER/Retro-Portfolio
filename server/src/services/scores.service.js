// PIXEL CUP leaderboard, kept in storage/scores.json.
import { byRank, pointsFor, toPublicScore } from '../models/score.model.js';

export const KEEP_SCORES = 100; // older/lower scores beyond this are dropped

export function createScoresService(store) {
  return {
    top(limit = 10) {
      return store.get().slice(0, limit).map(toPublicScore);
    },

    /** Saves a result → { rank, points }. rank is the 1-based place on the board. */
    async add({ initials, gf, ga }) {
      const entry = { initials, gf, ga, points: pointsFor(gf, ga), createdAt: new Date().toISOString() };
      let rank = 0;
      await store.update((list) => {
        const next = [...list, entry].sort(byRank);
        rank = next.indexOf(entry) + 1;
        return next.slice(0, KEEP_SCORES);
      });
      return { rank, points: entry.points };
    },
  };
}
