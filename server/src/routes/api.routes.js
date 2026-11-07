// Everything under /api.
//   GET  /api/health              → { ok: true }
//   GET  /api/content             → all site content (server/data/*.json merged)
//   GET  /api/content/:section    → one file, e.g. /api/content/projects
//   GET  /api/scores              → PIXEL CUP top 10
//   POST /api/scores              → { initials, gf, ga }
//   GET  /api/visits              → { count }
//   POST /api/visits              → count this visit
import express, { Router } from 'express';
import { createContentController } from '../controllers/content.controller.js';
import { createScoresController } from '../controllers/scores.controller.js';
import { createVisitsController } from '../controllers/visits.controller.js';
import { apiNotFound } from '../middleware/errors.js';
import { contentRoutes } from './content.routes.js';
import { scoresRoutes } from './scores.routes.js';
import { visitsRoutes } from './visits.routes.js';

export function apiRoutes({ content, scores, visits }) {
  const api = Router();
  api.use(express.json({ limit: '2kb' }));

  api.get('/health', (req, res) => res.set('Cache-Control', 'no-store').json({ ok: true }));
  api.use('/content', contentRoutes(createContentController(content)));
  api.use('/scores', scoresRoutes(createScoresController(scores)));
  api.use('/visits', visitsRoutes(createVisitsController(visits)));

  api.use(apiNotFound);
  return api;
}
