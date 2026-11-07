export function createVisitsController(visits) {
  return {
    /** GET /api/visits → { count } */
    get(req, res) {
      res.set('Cache-Control', 'no-store').json({ count: visits.count() });
    },

    /** POST /api/visits → { count } after counting this visit (the site sends one per browser session) */
    async increment(req, res) {
      res.set('Cache-Control', 'no-store').json({ count: await visits.increment() });
    },
  };
}
