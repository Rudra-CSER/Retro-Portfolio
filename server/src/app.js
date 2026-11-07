// Builds the Express app:  security → compression → /api → website → errors.
// Kept separate from server.js so tests can start it on a random port with temp folders.
import path from 'node:path';
import compression from 'compression';
import express from 'express';
import { errorHandler } from './middleware/errors.js';
import { securityHeaders } from './middleware/security.js';
import { sanitizeStoredScores } from './models/score.model.js';
import { apiRoutes } from './routes/api.routes.js';
import { webRoutes } from './routes/web.routes.js';
import { createContentService } from './services/content.service.js';
import { createScoresService } from './services/scores.service.js';
import { createVisitsService, sanitizeVisits } from './services/visits.service.js';
import { openJsonStore } from './utils/jsonStore.js';

/**
 * @param {{ paths: { data: string, public: string, storage: string, dist: string }, trustProxy?: unknown }} config
 * @returns {Promise<{ app: import('express').Express, close: () => Promise<void> }>}
 * Rejects with a ContentError if server/data has problems.
 */
export async function createApp(config, { logger = console } = {}) {
  const { paths } = config;

  const content = createContentService({ dataDir: paths.data, publicDir: paths.public, logger });
  await content.load();

  const [scoresStore, visitsStore] = await Promise.all([
    openJsonStore(path.join(paths.storage, 'scores.json'), { defaults: [], sanitize: sanitizeStoredScores, logger }),
    openJsonStore(path.join(paths.storage, 'visits.json'), { defaults: { count: 0 }, sanitize: sanitizeVisits, logger }),
  ]);
  const scores = createScoresService(scoresStore);
  const visits = createVisitsService(visitsStore);

  const app = express();
  app.set('trust proxy', config.trustProxy ?? 'loopback');
  app.use(securityHeaders());
  app.use(compression());
  app.use('/api', apiRoutes({ content, scores, visits }));
  app.use(webRoutes({ distDir: paths.dist, publicDir: paths.public, content }));
  app.use(errorHandler(logger));

  return {
    app,
    /** Waits for pending leaderboard/counter writes. */
    close: () => Promise.all([scoresStore.flush(), visitsStore.flush()]).then(() => {}),
  };
}
