import { Router } from 'express';

export function contentRoutes(controller) {
  const router = Router();
  router.get('/', controller.getAll);
  router.get('/:section', controller.getSection);
  return router;
}
