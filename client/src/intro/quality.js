// How much of the opening this device can carry, decided by the device itself.
//
//   full   · the PS1 bedroom at full resolution
//   light  · the same scene at a lower resolution (about half the pixels to draw)
//   simple · just the TV picture: power-on, boot logo, title screen (no 3D room)
//   off    · straight into the site
//
// The intro starts at the best version this browser is allowed (see chooseTier), then a
// monitor watches every frame it draws and steps down one version at a time when:
//   · a frame takes too long to draw (median over the last second above the budget)
//   · fewer than MIN_FPS frames arrive in a whole second
//   · the picture keeps stuttering (JANK_COUNT long gaps within JANK_WINDOW_MS)
//   · drawing throws an error
// It never steps back up during a visit. What it settles on is remembered for a week, so a
// slow laptop starts on its own version next time. Nothing here asks the visitor anything.

export const TIERS = ['full', 'light', 'simple', 'off'];

const MEMORY = 'rudra.introTier'; // what an earlier visit settled on: { tier, at }
const CHOICE = 'rudra.intro'; // the visitor's own pick from the pause menu: auto · full · lite · off
const MEMORY_MS = 7 * 24 * 3600 * 1000;

const WARMUP = 5; // draws ignored after a start or a step down (JIT warm-up, canvas resize)
const SETTLE_MS = 1500; // the page itself is still starting up: frame-rate rules wait this long
const WINDOW_MS = 1000; // frame-rate window
const MIN_FPS = { full: 15, light: 15, simple: 8 };
const BUDGET_MS = { full: 24, light: 24, simple: 40 }; // median draw time allowed per frame
const JANK_GAP_MS = 120; // a gap this long between two frames is a visible stutter
const JANK_COUNT = 5;
const JANK_WINDOW_MS = 2500;
const LIGHT_TO_FULL = 2.25; // (270 / 180)²: how many more pixels the full version draws

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: nothing to remember */
  }
};

const ALIAS = { full: 'full', light: 'light', lite: 'light', simple: 'simple', off: 'off', skip: 'off' };

/** Live numbers for the ?debug=1 panel. */
export const diag = {
  tier: null,
  source: null,
  reason: '',
  fps: 0,
  cost: 0,
  res: '',
  steps: [],
};

/**
 * Where the intro starts.
 *  ?intro=full|light|simple|off in the address · fixed, nothing automatic (for testing)
 *  the pause menu's INTRO choice (FULL is fixed; LITE can still step down; OFF skips)
 *  what this browser settled on last time (for a week)
 *  otherwise full, watched
 */
export function chooseTier() {
  let pick = null;
  try {
    pick = ALIAS[new URLSearchParams(window.location.search).get('intro')] || null;
  } catch {
    /* no URL API */
  }
  let result;
  if (pick) result = { tier: pick, auto: false, source: 'url' };
  else {
    const choice = read(CHOICE);
    if (choice === 'full') result = { tier: 'full', auto: false, source: 'choice' };
    else if (choice === 'lite') result = { tier: 'light', auto: true, source: 'choice' };
    else if (choice === 'off') result = { tier: 'off', auto: false, source: 'choice' };
    else {
      const mem = read(MEMORY);
      const fresh = mem && TIERS.includes(mem.tier) && Date.now() - (mem.at || 0) < MEMORY_MS;
      result = fresh ? { tier: mem.tier, auto: true, source: 'memory' } : { tier: 'full', auto: true, source: 'auto' };
    }
  }
  Object.assign(diag, { tier: result.tier, source: result.source, reason: result.source === 'memory' ? 'remembered from an earlier visit' : '' });
  return result;
}

/** Remember how the intro ended for next time (only what the device decided, never a choice). */
export function rememberTier(final, { source, healthy }) {
  if (source !== 'auto' && source !== 'memory') return;
  if (final === 'full') write(MEMORY, null);
  // it ran comfortably on the lower version: try the full one again next time
  else if (source === 'memory' && healthy && final === read(MEMORY)?.tier && final !== 'off') write(MEMORY, null);
  else write(MEMORY, { tier: final, at: Date.now() });
}

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
};

/**
 * Watches the intro's frames. Call sample(ms) after every frame it draws and error() when a
 * frame throws. onChange(tier, reason) fires on every step down (the last one is 'off').
 */
export function createMonitor({ tier: start, auto, onChange, now = () => performance.now() }) {
  let tier = start;
  const born = now();
  let warm = 0;
  let since = born;
  let draws = []; // [time, cost]
  let errors = 0;
  let firstLook = true;

  function step(n, reason) {
    const i = Math.min(TIERS.length - 1, TIERS.indexOf(tier) + n);
    if (TIERS[i] === tier) return;
    tier = TIERS[i];
    warm = 0;
    since = now();
    draws = [];
    diag.tier = tier;
    diag.reason = reason;
    diag.steps.push(`${tier} · ${reason}`);
    onChange?.(tier, reason);
  }

  function check(t) {
    const recent = draws.filter((d) => t - d[0] <= WINDOW_MS);
    const cost = median(recent.map((d) => d[1]));
    const span = recent.length > 1 ? recent[recent.length - 1][0] - recent[0][0] : 0;
    const fps = span > 0 ? ((recent.length - 1) * 1000) / span : 0;
    diag.cost = Math.round(cost * 10) / 10;
    diag.fps = Math.round(fps);
    if (!auto || recent.length < 8) return;

    // the first proper look: a device far too slow for this version skips straight past the next
    if (firstLook && recent.length >= 10) {
      firstLook = false;
      if (tier === 'full' && cost > BUDGET_MS.full * 2) return step(2, `draws took ${Math.round(cost)} ms`);
    }
    if (cost > BUDGET_MS[tier]) return step(1, `draws took ${Math.round(cost)} ms`);

    // frame-rate rules wait until the page has finished starting and the window is full
    if (t - born < SETTLE_MS || t - since < WINDOW_MS) return;
    if (span >= WINDOW_MS * 0.8 && fps < MIN_FPS[tier]) return step(1, `${Math.round(fps)} fps`);

    const gaps = [];
    const win = draws.filter((d) => t - d[0] <= JANK_WINDOW_MS);
    for (let k = 1; k < win.length; k++) gaps.push(win[k][0] - win[k - 1][0]);
    if (gaps.filter((g) => g > JANK_GAP_MS).length >= JANK_COUNT) step(1, 'stuttering');
  }

  return {
    get tier() {
      return tier;
    },
    /** One frame was drawn; `cost` is how long drawing it took (ms). */
    sample(cost) {
      if (tier === 'off') return;
      errors = 0;
      const t = now();
      warm += 1;
      if (warm <= WARMUP) return;
      draws.push([t, cost]);
      if (draws.length > 160) draws = draws.slice(-120);
      check(t);
    },
    /** A frame threw. Once is a warning; twice in a row on one version means that version is broken here. */
    error(err) {
      errors += 1;
      diag.reason = String(err?.message || err).slice(0, 80);
      if (errors >= 2) {
        errors = 0;
        step(1, 'drawing failed');
      }
    },
    /**
     * Would the next version up very likely fit next time? Only `light` can tell: it draws the
     * same scene as `full` with LIGHT_TO_FULL times fewer pixels, so its draw time predicts full's.
     * (`simple` draws something else entirely, so a device that needed it keeps it until the
     * memory expires, instead of stuttering through the full version on every other visit.)
     */
    healthy() {
      return tier === 'light' && diag.fps >= 26 && diag.cost > 0 && diag.cost * LIGHT_TO_FULL < BUDGET_MS.full * 0.75;
    },
    stepDown: step,
  };
}
