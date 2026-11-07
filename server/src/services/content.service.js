// Reads the JSON folder (server/data/*.json) and serves it as one object.
//
// - Every file is checked against models/content.model.js.
// - At startup, broken content stops the server with a list of problems.
// - While running, edits are picked up on the next request (no restart).
//   If an edit breaks a file, the last good version keeps being served and
//   the problem is logged once.
import fs from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_FILES, validateContentFile } from '../models/content.model.js';

export class ContentError extends Error {
  constructor(problems, warnings = []) {
    super(`Content has ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
    this.name = 'ContentError';
    this.problems = problems;
    this.warnings = warnings;
  }

  report() {
    return [`✖ ${this.message} (server/data/):`, ...this.problems.map((p) => `   • ${p}`)].join('\n');
  }
}

/** "projects.json" → "projects" */
const sectionName = (file) => path.basename(file, '.json');

export function createContentService({ dataDir, publicDir, logger = console }) {
  let current = null; // { signature, sections, content, warnings }
  let loading = null;
  let lastFailure = null;

  // Size + modified time of every file. A different signature means something changed.
  async function signature() {
    const parts = await Promise.all(
      CONTENT_FILES.map((file) =>
        fs.stat(path.join(dataDir, file)).then(
          (s) => `${file}:${s.size}:${s.mtimeMs}`,
          () => `${file}:missing`,
        ),
      ),
    );
    return parts.join('|');
  }

  async function readAll() {
    const problems = [];
    const warnings = [];
    const sections = {};
    const owner = new Map(); // top-level key → file that defines it

    for (const file of CONTENT_FILES) {
      let data;
      try {
        data = JSON.parse(await fs.readFile(path.join(dataDir, file), 'utf8'));
      } catch (err) {
        problems.push(err.code === 'ENOENT' ? `${file}: file is missing` : `${file}: not valid JSON (${err.message})`);
        continue;
      }
      const result = validateContentFile(file, data);
      problems.push(...result.errors.map((m) => `${file}: ${m}`));
      warnings.push(...result.warnings.map((m) => `${file}: ${m}`));
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const key of Object.keys(data)) {
          if (owner.has(key)) problems.push(`${file}: "${key}" is also defined in ${owner.get(key)}`);
          else owner.set(key, file);
        }
      }
      sections[sectionName(file)] = data;
    }

    if (problems.length) throw new ContentError(problems, warnings);
    return { sections, content: Object.assign({}, ...Object.values(sections)), warnings };
  }

  async function refresh() {
    const sig = await signature();
    if (current && current.signature === sig) return current;
    if (!loading) {
      loading = readAll()
        .then(
          (next) => {
            const first = current === null;
            current = { signature: sig, ...next };
            lastFailure = null;
            if (!first) logger.log('[content] reloaded server/data');
            for (const w of next.warnings) logger.warn(`[content] warning — ${w}`);
            return current;
          },
          (err) => {
            if (!current) throw err;
            if (lastFailure !== sig) {
              lastFailure = sig;
              logger.error(`[content] edit not applied, still serving the last good version.\n${err.report?.() ?? err.message}`);
            }
            return current;
          },
        )
        .finally(() => {
          loading = null;
        });
    }
    return loading;
  }

  // A site path like "/resume.pdf" only counts if the file is really in server/public/;
  // otherwise it becomes "" and the site hides the link (or shows the pixel art instead).
  async function existingLink(link) {
    if (!link || !link.startsWith('/')) return link;
    let rel;
    try {
      rel = decodeURIComponent(link.split(/[?#]/)[0]);
    } catch {
      return '';
    }
    const file = path.resolve(publicDir, `.${rel}`);
    if (!file.startsWith(path.resolve(publicDir) + path.sep)) return '';
    const stat = await fs.stat(file).catch(() => null);
    return stat?.isFile() ? link : '';
  }

  return {
    /** Loads and checks everything. Throws ContentError if anything is wrong. */
    async load() {
      const { warnings } = await refresh();
      return { warnings };
    },

    /** The whole site's content, as served by GET /api/content. */
    async getContent() {
      const { content } = await refresh();
      const [resume, images] = await Promise.all([
        existingLink(content.person.links.resume),
        Promise.all(content.projects.map((p) => existingLink(p.image))),
      ]);
      return {
        ...content,
        person: { ...content.person, links: { ...content.person.links, resume } },
        projects: content.projects.map((p, i) => (images[i] === p.image ? p : { ...p, image: images[i] })),
      };
    },

    /** One file's data, e.g. getSection('projects'). null if there is no such file. */
    async getSection(name) {
      const { sections } = await refresh();
      return Object.hasOwn(sections, name) ? sections[name] : null;
    },

    sectionNames: () => CONTENT_FILES.map(sectionName),

    /** A string that changes whenever any content file changes. */
    async version() {
      return (await refresh()).signature;
    },
  };
}
