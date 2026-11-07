import { validateScoreInput } from '../models/score.model.js';
import { HttpError } from '../utils/httpError.js';

const BOARD_SIZE = 10;

export function createScoresController(scores) {
  return {
    /** GET /api/scores → { scores: top 10 } */
    list(req, res) {
      res.set('Cache-Control', 'no-store').json({ scores: scores.top(BOARD_SIZE) });
    },

    /** POST /api/scores { initials, gf, ga } → 201 { rank, points, scores } */
    async create(req, res) {
      const { value, errors } = validateScoreInput(req.body);
      if (errors) throw new HttpError(400, Object.values(errors)[0], { fields: errors });
      const { rank, points } = await scores.add(value);
      res.status(201).json({ rank, points, scores: scores.top(BOARD_SIZE) });
    },
  };
}
