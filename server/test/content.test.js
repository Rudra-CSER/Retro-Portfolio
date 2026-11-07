import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { CONTENT_FILES, validateContentFile } from '../src/models/content.model.js';
import { createApp } from '../src/app.js';
import { ContentError } from '../src/services/content.service.js';
import { DATA_DIR, makeDirs, memoryLogger, readData, startServer, writeData } from './helpers.js';

describe('the content in server/data', () => {
  for (const file of CONTENT_FILES) {
    test(`${file} matches the content model`, async () => {
      const data = JSON.parse(await fs.readFile(path.join(DATA_DIR, file), 'utf8'));
      const { errors, warnings } = validateContentFile(file, data);
      assert.deepEqual(errors, []);
      assert.deepEqual(warnings, []);
    });
  }
});

describe('GET /api/content', () => {
  let site;
  before(async () => {
    site = await startServer();
  });
  after(() => site.stop());

  test('returns every file merged into one object', async () => {
    const { status, data, headers } = await site.request('/api/content');
    assert.equal(status, 200);
    assert.match(headers.get('content-type'), /application\/json/);
    for (const key of ['person', 'about', 'abilities', 'projects', 'hallOfFame', 'meta', 'contact', 'game', 'mobile']) {
      assert.ok(key in data, `missing ${key}`);
    }
    assert.equal(data.person.email, 'rudranarayanmondal20@gmail.com');
    assert.equal(data.mobile.chapters.length, 6);
  });

  test('lets browsers revalidate cheaply (ETag → 304)', async () => {
    const first = await site.request('/api/content');
    assert.equal(first.headers.get('cache-control'), 'no-cache');
    const etag = first.headers.get('etag');
    assert.ok(etag);
    // (fetch() would add "cache-control: no-cache" to a hand-made conditional request; a browser revalidating doesn't)
    const second = await site.request('/api/content', { headers: { 'if-none-match': etag, 'cache-control': 'max-age=0' } });
    assert.equal(second.status, 304);
  });

  test('hides the resume link until server/public/resume.pdf exists', async () => {
    let { data } = await site.request('/api/content');
    assert.equal(data.person.links.resume, '');
    await fs.writeFile(path.join(site.dirs.public, 'resume.pdf'), '%PDF-1.4 test');
    ({ data } = await site.request('/api/content'));
    assert.equal(data.person.links.resume, '/resume.pdf');
  });

  test('falls back to pixel art when a project screenshot is missing', async () => {
    const projects = await readData(site.dirs, 'projects.json');
    projects.projects[0].image = '/shots/missing.png';
    projects.projects[1].image = '/shots/there.png';
    await writeData(site.dirs, 'projects.json', projects);
    await fs.mkdir(path.join(site.dirs.public, 'shots'), { recursive: true });
    await fs.writeFile(path.join(site.dirs.public, 'shots', 'there.png'), 'png');
    const { data } = await site.request('/api/content');
    assert.equal(data.projects[0].image, '');
    assert.equal(data.projects[1].image, '/shots/there.png');
  });

  test('GET /api/content/:section returns one file as-is', async () => {
    const { status, data } = await site.request('/api/content/achievements');
    assert.equal(status, 200);
    assert.deepEqual(Object.keys(data), ['hallOfFame']);
    const missing = await site.request('/api/content/passwords');
    assert.equal(missing.status, 404);
    assert.match(missing.data.error, /No content section/);
  });
});

describe('editing content while the server runs', () => {
  let site;
  before(async () => {
    site = await startServer();
  });
  after(() => site.stop());

  test('a saved edit shows up on the next request, no restart', async () => {
    const profile = await readData(site.dirs, 'profile.json');
    profile.about.accent = 'Edited live.';
    await writeData(site.dirs, 'profile.json', profile);
    const { data } = await site.request('/api/content');
    assert.equal(data.about.accent, 'Edited live.');
  });

  test('a broken edit keeps the last good version online and is logged once', async () => {
    await writeData(site.dirs, 'skills.json', '{ "abilities": [ oops ');
    const first = await site.request('/api/content');
    const second = await site.request('/api/content');
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.ok(first.data.abilities.length > 0);
    const errors = site.logger.lines.error.filter((l) => l.includes('skills.json'));
    assert.equal(errors.length, 1);
    assert.match(errors[0], /not valid JSON/);
  });

  test('fixing the file brings the new version back', async () => {
    await writeData(site.dirs, 'skills.json', await fs.readFile(path.join(DATA_DIR, 'skills.json'), 'utf8'));
    const { data } = await site.request('/api/content');
    assert.ok(data.abilities.length > 0);
    assert.ok(site.logger.lines.log.some((l) => l.includes('reloaded')));
  });
});

describe('content mistakes are caught with clear messages', () => {
  const problemsFor = async (mutate) => {
    const dirs = await makeDirs();
    await mutate(dirs);
    try {
      await createApp({ paths: dirs }, { logger: memoryLogger() });
    } catch (err) {
      assert.ok(err instanceof ContentError, `expected ContentError, got ${err}`);
      return err.problems;
    }
    assert.fail('expected the app to refuse broken content');
  };

  test('invalid JSON names the file', async () => {
    const problems = await problemsFor((d) => writeData(d, 'projects.json', '{ "projects": [ }'));
    assert.match(problems.join('\n'), /^projects\.json: not valid JSON/m);
  });

  test('a missing file is reported', async () => {
    const problems = await problemsFor((d) => fs.rm(path.join(d.data, 'achievements.json')));
    assert.deepEqual(problems, ['achievements.json: file is missing']);
  });

  test('bad values point at the exact field', async () => {
    const problems = await problemsFor(async (d) => {
      const profile = await readData(d, 'profile.json');
      profile.person.email = 'not-an-email';
      profile.person.timezone = 'Mars/Olympus';
      profile.person.links.linkedin = 'javascript:alert(1)';
      delete profile.about.short;
      await writeData(d, 'profile.json', profile);
      const projects = await readData(d, 'projects.json');
      projects.projects[1].slug = projects.projects[0].slug;
      projects.projects[2].bg = 'blue';
      await writeData(d, 'projects.json', projects);
    });
    const text = problems.join('\n');
    assert.match(text, /profile\.json: person\.email must be an email address/);
    assert.match(text, /profile\.json: person\.timezone must be an IANA time zone/);
    assert.match(text, /profile\.json: person\.links\.linkedin must be a full http\(s\):\/\/ link/);
    assert.match(text, /profile\.json: about\.short is missing/);
    assert.match(text, /projects\.json: projects\[1\]\.slug "setu" is used twice/);
    assert.match(text, /projects\.json: projects\[2\]\.bg must be a hex colour/);
  });

  test('the phone layout needs exactly six chapters', async () => {
    const problems = await problemsFor(async (d) => {
      const site = await readData(d, 'site.json');
      site.mobile.chapters.pop();
      await writeData(d, 'site.json', site);
    });
    assert.match(problems.join('\n'), /mobile\.chapters must have exactly 6 items/);
  });

  test('two files may not define the same section', async () => {
    const problems = await problemsFor(async (d) => {
      const skills = await readData(d, 'skills.json');
      skills.projects = [];
      await writeData(d, 'skills.json', skills);
    });
    assert.match(problems.join('\n'), /"projects" is also defined in skills\.json/);
  });

  test('unknown keys are warnings, not errors (usually a typo)', () => {
    const { errors, warnings } = validateContentFile('achievements.json', { hallOfFame: [], hallOffame: [] });
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, ['hallOffame is not used by the site (typo?)']);
  });
});
