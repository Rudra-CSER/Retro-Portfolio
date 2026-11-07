// The Cloudflare Worker (wrangler.jsonc → main).
// Cloudflare serves the static site (build/cloudflare) straight from its edge and only runs this
// code for /api/* (see run_worker_first in wrangler.jsonc) and for paths with no file.
import data from '../build/worker-data.json' with { type: 'json' };
import { createApi } from './api.js';

const api = createApi(data);

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) return api(request, env);
    // No such file: the static-files handler answers with the retro 404 page.
    return env.ASSETS.fetch(request);
  },
};
