// The shape of every file in server/data/. The server checks the files against this
// at startup and whenever you edit them, so a typo shows up as a clear message
// ("projects.json: projects[2].liveUrl must be a full http(s):// link")
// instead of a blank page. Run `npm run check` to check them by hand.
import { color, email, list, optional, shape, siteLink, slug, text, timezone, url, validate } from '../utils/schema.js';

const person = shape({
  name: text(),
  shortName: text(),
  logotype: text(),
  initials: text(),
  role: text(),
  org: text(),
  location: text(),
  origin: text(),
  coords: text(),
  timezone: timezone(),
  availability: text(),
  email: email(),
  domain: text({ empty: true }),
  links: shape({
    github: url(),
    linkedin: url({ empty: true }),
    x: url({ empty: true }),
    resume: siteLink({ empty: true }),
  }),
});

const project = shape({
  slug: slug(),
  name: text(),
  category: text(),
  tags: list(text(), { min: 1 }),
  title: text(),
  description: text(),
  stat: text({ empty: true }),
  status: text(),
  highlights: list(text()),
  liveUrl: url({ empty: true }),
  sourceUrl: url({ empty: true }),
  image: siteLink({ empty: true }),
  sprite: text(),
  bg: color(),
});

/** One schema per file. The top-level keys of all files together make up GET /api/content. */
export const CONTENT_SCHEMAS = {
  'profile.json': shape({
    person,
    about: shape({ label: text(), paragraph: text(), accent: text(), caption: text(), tagline: text(), short: text() }),
    player: shape({ stats: list(shape({ k: text(), v: text() }), { min: 1 }), stack: text() }),
    manual: shape({
      label: text(),
      word: text(),
      pronunciation: text(),
      pos: text(),
      definition: text(),
      definition2: text(),
      synonyms: text(),
      creditLead: text(),
      creditLink: text(),
    }),
  }),

  'skills.json': shape({
    abilities: list(shape({ left: text(), right: text(), detail: text() }), { min: 1 }),
    tools: list(text(), { min: 1 }),
    expertise: list(text()),
  }),

  'projects.json': shape({
    projects: list(project, { min: 1, uniqueBy: 'slug' }),
    more: list(list(shape({ label: text(), caption: text(), sprite: text() }), { min: 1 })),
  }),

  'achievements.json': shape({
    hallOfFame: list(shape({ title: text(), detail: text(), score: text() })),
  }),

  'site.json': shape({
    meta: shape({
      title: text(),
      description: text(),
      shareTitle: text(),
      shareDescription: text(),
      shareImage: optional(siteLink()),
      shareImageAlt: optional(text()),
      siteUrl: url({ empty: true }),
    }),
    boot: shape({ servedFrom: text({ empty: true }) }),
    hero: shape({
      lines: list(text(), { min: 1 }),
      linesMobile: list(text(), { min: 1 }),
      italic: text(),
      cycleLabel: text(),
      cycle: list(text(), { min: 1 }),
    }),
    stageSelect: shape({ label: text(), headline: text(), italic: text(), caption: text() }),
    contact: shape({ label: text(), headline: text(), italic: text(), cta: text(), subject: text() }),
    game: shape({
      title: text(),
      tagline: text(),
      home: shape({ name: text(), short: text(), star: text() }),
      away: shape({ name: text(), short: text() }),
    }),
    // Phone chapters, in page order: bio, skills, quests, fame, play, contact.
    mobile: shape({ chapters: list(shape({ label: text(), title: text(), kicker: text({ empty: true }) }), { exactly: 6 }) }),
  }),
};

export const CONTENT_FILES = Object.keys(CONTENT_SCHEMAS);

/** → { errors: string[], warnings: string[] } */
export function validateContentFile(file, data) {
  const schema = CONTENT_SCHEMAS[file];
  if (!schema) return { errors: [`${file} is not a known content file`], warnings: [] };
  return validate(schema, data);
}
