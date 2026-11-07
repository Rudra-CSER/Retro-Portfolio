import { HttpError } from '../utils/httpError.js';

// Browsers may keep a copy but must check back each time (a cheap 304 when nothing changed),
// so content edits show up on the next page load.
const REVALIDATE = 'no-cache';

export function createContentController(content) {
  return {
    /** GET /api/content → everything the site shows */
    async getAll(req, res) {
      res.set('Cache-Control', REVALIDATE).json(await content.getContent());
    },

    /** GET /api/content/:section → one file from server/data, e.g. /api/content/projects */
    async getSection(req, res) {
      const data = await content.getSection(req.params.section);
      if (!data) {
        throw new HttpError(404, `No content section "${req.params.section}". Try: ${content.sectionNames().join(', ')}.`);
      }
      res.set('Cache-Control', REVALIDATE).json(data);
    },
  };
}
