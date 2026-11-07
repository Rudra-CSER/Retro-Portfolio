import { Router } from 'express';
import { limitRequests } from '../middleware/rateLimit.js';

export function scoresRoutes(controller) {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', limitRequests({ minutes: 10, limit: 20, message: 'Slow down, striker. Try again in a few minutes.' }), controller.create);
  return router;
}
