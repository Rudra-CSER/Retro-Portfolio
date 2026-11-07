import { Router } from 'express';
import { limitRequests } from '../middleware/rateLimit.js';

export function visitsRoutes(controller) {
  const router = Router();
  router.get('/', controller.get);
  router.post('/', limitRequests({ minutes: 60, limit: 30, message: 'Easy there.' }), controller.increment);
  return router;
}
