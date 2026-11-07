// PIXEL CUP '96 — a 4-a-side football mini-game in the spirit of mid-90s
// broadcast-camera console football: pseudo-3D pitch, scrolling camera,
// crowd + ad boards, radar, text commentary, auto player-switching.
// Pure canvas 2D, ~zero dependencies. All units are metres and seconds.
import { drawPixelText, measureText } from '../lib/pixelfont';

export const VW = 512;
export const VH = 288;

const L = 64; // pitch length
const W = 40; // pitch width
const GOAL_W = 7.4;
const GOAL_H = 2.4;
const GOAL_D = 1.8;
const PPM = 13.6; // pixels per metre at the near touchline
const FAR_Y = 98;
const NEAR_Y = 262;
const S_FAR = 0.62;
export const MATCH_SECONDS = 90;
const HUMAN_SPEED = 6.5;
const AI_SPEED = 5.5;
const ROLL_DECEL = 3.3;
const GRAV = 9.8;

const KITS = [
  { shirt: '#FFB627', trim: '#C98400', shorts: '#141414', socks: '#FFB627', gk: '#24C8A6' },
  { shirt: '#EDEDED', trim: '#BDBDBD', shorts: '#C8102E', socks: '#EDEDED', gk: '#8A5CFF' },
];
const SKIN = ['#E8B48A', '#C68642', '#8D5524', '#F1C27D', '#B5774B', '#D9A066', '#7A4A2A', '#E0AC69'];
const HAIR = ['#1B1B1B', '#3B2416', '#0E0E0E', '#6B4423', '#151515', '#2A1A10', '#0A0A0A', '#4A3020'];

// Commentary. Team names come from site.json → game.
const DEFAULT_TEAMS = { home: { name: 'RNM XI', short: 'RNM', star: 'RUDRA' }, away: { name: 'DEADLINE FC', short: 'DFC' } };
const makeLines = ({ home, away }) => ({
  kickoff: ["AND WE'RE UNDERWAY AT THE PIXEL ARENA!", 'THE REF BLOWS - HERE WE GO!', 'KICK OFF! NINETY SECONDS ON THE CLOCK.'],
  shot: ['HE SHOOTS!', 'HAS A GO FROM THERE!', 'LETS FLY!', 'GOES FOR GOAL!'],
  save: ['WHAT A SAVE!', 'THE KEEPER GATHERS IT.', 'STRONG HANDS FROM THE KEEPER!', 'DENIED!'],
  goal0: [`GOAL! WHAT A FINISH FROM ${home.star}!`, "IT'S IN! THE PIXEL ARENA ERUPTS!", 'GOAL! SCIENCE THAT SHIPS!', 'TOP BINS! ABSOLUTELY TOP BINS!'],
  goal1: [`GOAL... ${away.name} STRIKE BACK.`, 'THEY SCORE. THE DEADLINE LOOMS!', `A GOAL FOR ${away.name}. SCOPE CREEP!`],
  wide: ['JUST WIDE!', 'OFF TARGET.', 'INCHES AWAY!'],
  over: ['OVER THE BAR!', 'BLAZED OVER!'],
  post: ['OFF THE POST!', 'CLANG! THE WOODWORK SAVES THEM.'],
  tackle: ['GOOD CHALLENGE!', 'WON IT BACK!', 'CRUNCHING TACKLE!'],
  throwin: ['THROW-IN.'],
  goalkick: ['GOAL KICK.'],
  fulltime: ["AND THAT'S FULL TIME!", 'THE REF CALLS TIME!'],
  demo: ['DEMO MODE - PRESS START TO PLAY.', `${home.name} VS ${away.name}.`],
});
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function project(x, y, z, camX) {
  const t = y / W;
  const s = S_FAR + (1 - S_FAR) * t;
  return { x: VW / 2 + (x - camX) * PPM * s, y: FAR_Y + t * (NEAR_Y - FAR_Y) - z * PPM * s * 0.92, s };
}

function makeCrowd() {
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = FAR_Y - 17;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, '#07080d');
  g.addColorStop(1, '#141724');
  c.fillStyle = g;
  c.fillRect(0, 0, cv.width, cv.height);
  const cols = ['#FFB627', '#EDEDED', '#C8102E', '#3D7BFF', '#2FBF71', '#FF8A3D', '#8A5CFF', '#E8B48A', '#C68642', '#555'];
  for (let row = 0; row < 16; row++) {
    const y = 6 + row * 4;
    if (y > cv.height - 3) break;
    c.fillStyle = row % 2 ? '#0d0f17' : '#10131d';
    c.fillRect(0, y + 2, cv.width, 2);
    for (let x = (row % 2) * 2; x < cv.width; x += 3) {
      if (Math.random() < 0.12) continue;
      c.fillStyle = cols[(Math.random() * cols.length) | 0];
      c.fillRect(x, y, 2, 2);
    }
  }
  // stadium roof lights
  c.fillStyle = '#2a2f45';
  c.fillRect(0, 0, cv.width, 3);
  for (let x = 20; x < cv.width; x += 128) {
    c.fillStyle = '#FFF6D5';
    c.fillRect(x, 1, 10, 2);
  }
  return cv;
}

export function createPixelCup(canvas, { onEvent = () => {}, sfx = {}, crowd = {}, matchSeconds = MATCH_SECONDS, teams = DEFAULT_TEAMS } = {}) {
  const TEAMS = { home: { ...DEFAULT_TEAMS.home, ...teams.home }, away: { ...DEFAULT_TEAMS.away, ...teams.away } };
  const LINES = makeLines(TEAMS);
  const MATCH_LEN = Math.min(MATCH_SECONDS, Math.max(5, matchSeconds));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  canvas.width = VW;
  canvas.height = VH;
  ctx.imageSmoothingEnabled = false;
  const crowdCv = makeCrowd();
  const snd = sfx;

  const S = {
    phase: 'demo',
    phaseT: 0,
    clock: 0,
    time: 0,
    score: [0, 0],
    demo: true,
    paused: false,
    camX: L / 2,
    banner: null,
    ticker: { text: pick(LINES.demo), shown: 0, at: 0 },
    kickoffTeam: 0,
    lastShot: null,
    celebrate: -1,
    shake: 0,
    lastSay: 0,
  };
  const ball = { x: L / 2, y: W / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTouch: 0, noCatch: null, noCatchT: 0, spin: 0 };
  const input = { x: 0, y: 0, shootHeld: false, shootT: 0, passEdge: false, shootEdge: false, shootRelease: false };
  let human = null;
  let switchCD = 0;

  const ROLES = [
    { role: 'GK', hx: 1.6, hy: W / 2 },
    { role: 'DF', hx: L * 0.2, hy: W / 2 },
    { role: 'ML', hx: L * 0.38, hy: W * 0.27 },
    { role: 'MR', hx: L * 0.38, hy: W * 0.73 },
  ];
  const players = [];
  for (const team of [0, 1]) {
    ROLES.forEach((r, i) => {
      const hx = team === 0 ? r.hx : L - r.hx;
      players.push({
        team, idx: i, role: r.role, hx, hy: r.hy, x: hx, y: r.hy, vx: 0, vy: 0,
        fx: team === 0 ? 1 : -1, fy: 0, anim: Math.random() * 10,
        kickT: 0, tackleCD: 0, lungeT: 0, decT: 0, weave: 0, holdT: 0, diveT: 0, diveDir: 0, reactT: 0, jump: 0,
        skin: SKIN[(team * 4 + i) % SKIN.length], hair: HAIR[(team * 4 + i * 3) % HAIR.length],
      });
    });
  }
  const gkOf = (t) => players.find((p) => p.team === t && p.role === 'GK');
  const attackDir = (t) => (t === 0 ? 1 : -1);

  function say(kind, force = false) {
    if (!force && S.time - S.lastSay < 1.2) return;
    S.lastSay = S.time;
    S.ticker = { text: pick(LINES[kind]), shown: 0, at: S.time };
  }
  const banner = (text, dur = 1.6, scale = 3) => (S.banner = { text, t: dur, dur, scale });

  // ── motion helpers ───────────────────────────────────────────────────────
  function accel(p, tvx, tvy, dt, a = 34) {
    const dvx = tvx - p.vx;
    const dvy = tvy - p.vy;
    const dl = Math.hypot(dvx, dvy);
    const m = a * dt;
    if (dl > m) {
      p.vx += (dvx / dl) * m;
      p.vy += (dvy / dl) * m;
    } else {
      p.vx = tvx;
      p.vy = tvy;
    }
  }
  function steerTo(p, tx, ty, speed, dt) {
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.12) return accel(p, 0, 0, dt, 26);
    const sp = Math.min(speed, d * 2.6);
    accel(p, (dx / d) * sp, (dy / d) * sp, dt, 26);
  }
  function integrate(p, dt) {
    p.x = clamp(p.x + p.vx * dt, -1.4, L + 1.4);
    p.y = clamp(p.y + p.vy * dt, -1.2, W + 1.2);
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 0.5) {
      p.fx += (p.vx / sp - p.fx) * Math.min(1, dt * 14);
      p.fy += (p.vy / sp - p.fy) * Math.min(1, dt * 14);
      const fl = Math.hypot(p.fx, p.fy) || 1;
      p.fx /= fl;
      p.fy /= fl;
    }
    p.anim += sp * dt;
  }
  function separate() {
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i];
        const b = players[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < 0.85) {
          const push = (0.85 - d) / 2;
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
        }
      }
    }
  }
  const nearest = (team, filter = () => true) => {
    let best = null;
    let bd = Infinity;
    for (const p of players) {
      if (p.team !== team || p.role === 'GK' || !filter(p)) continue;
      const d = dist(p, ball);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  };
  const nearestOpp = (p) => {
    let best = null;
    let bd = Infinity;
    for (const q of players) {
      if (q.team === p.team) continue;
      const d = dist(p, q);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  };

  // ── ball actions ─────────────────────────────────────────────────────────
  function kick(p, vx, vy, vz, power = 0.5) {
    ball.owner = null;
    ball.vx = vx;
    ball.vy = vy;
    ball.vz = vz;
    ball.z = Math.max(ball.z, 0.05);
    ball.lastTouch = p.team;
    ball.noCatch = p;
    ball.noCatchT = 0.3;
    p.kickT = 0.28;
    p.holdT = 0;
    snd.kick?.(power);
  }
  function takeBall(p) {
    ball.owner = p;
    ball.lastTouch = p.team;
    ball.vz = 0;
    if (p.team === 0 && !S.demo && p.role !== 'GK') {
      human = p;
      input.shootT = 0;
    }
  }
  function bestPassTarget(p, dirX = p.fx, dirY = p.fy) {
    let best = null;
    let bestScore = -Infinity;
    for (const q of players) {
      if (q === p || q.team !== p.team || q.role === 'GK') continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 3 || d > 36) continue;
      const align = (dx * dirX + dy * dirY) / d;
      const forward = ((q.x - p.x) * attackDir(p.team)) / d;
      const opp = nearestOpp(q);
      const open = opp ? Math.min(6, dist(q, opp)) / 6 : 1;
      const score = align * 2.4 + forward * 0.6 + open * 1.1 - d * 0.02;
      if (score > bestScore) {
        bestScore = score;
        best = q;
      }
    }
    return best;
  }
  function doPass(p, target, lob = false) {
    if (!target) return kick(p, p.fx * 12, p.fy * 12, 0, 0.3);
    const d0 = dist(p, target);
    const lead = clamp(d0 / 15, 0.15, 0.6);
    const tx = target.x + target.vx * lead;
    const ty = target.y + target.vy * lead;
    const dx = tx - ball.x;
    const dy = ty - ball.y;
    const d = Math.hypot(dx, dy) || 1;
    if (lob || d > 26) {
      const sp = clamp(d * 0.72, 10, 21);
      const flight = d / sp;
      kick(p, (dx / d) * sp, (dy / d) * sp, clamp((GRAV * flight) / 2, 3, 9), 0.5);
    } else {
      const sp = Math.sqrt(18 + 2 * ROLL_DECEL * d);
      kick(p, (dx / d) * sp, (dy / d) * sp, 0, 0.35);
    }
  }
  function shoot(p, power, aim) {
    const gx = p.team === 0 ? L + 0.6 : -0.6;
    const gy = W / 2 + clamp(aim, -1, 1) * (GOAL_W / 2 - 0.7) + (Math.random() - 0.5) * 1.2;
    const dx = gx - ball.x;
    const dy = gy - ball.y;
    const d = Math.hypot(dx, dy);
    const speed = 15 + 15 * power;
    const err = 0.02 + 0.07 * power * power + (d > 24 ? 0.04 : 0);
    const ang = Math.atan2(dy, dx) + (Math.random() * 2 - 1) * err;
    const t = d / speed;
    const h = 0.25 + power * power * 2.05 + Math.random() * 0.45 * power;
    const vz = clamp((h + 0.5 * GRAV * t * t) / t, 0, 10);
    kick(p, Math.cos(ang) * speed, Math.sin(ang) * speed, vz, power);
    S.lastShot = { team: p.team, t: S.time, speed };
    say('shot');
  }
  function steal(p) {
    const prev = ball.owner;
    if (prev) {
      prev.tackleCD = 0.9;
      prev.kickT = 0.35;
    }
    takeBall(p);
    p.tackleCD = 0.5;
  }

  // ── players ──────────────────────────────────────────────────────────────
  function chooseHuman() {
    if (ball.owner && ball.owner.team === 0 && ball.owner.role !== 'GK') {
      human = ball.owner;
      return;
    }
    const best = nearest(0);
    if (!human || human.role === 'GK') {
      human = best;
      return;
    }
    if (switchCD <= 0 && best !== human && dist(best, ball) + 3 < dist(human, ball)) {
      human = best;
      switchCD = 0.6;
    }
  }

  function controlHuman(p, dt) {
    const mag = Math.hypot(input.x, input.y);
    const has = ball.owner === p;
    const sp = HUMAN_SPEED * (has ? 0.9 : 1) * (p.lungeT > 0 ? 1.55 : 1);
    if (mag > 0.15) accel(p, (input.x / Math.max(1, mag)) * sp, (input.y / Math.max(1, mag)) * sp, dt, 44);
    else accel(p, 0, 0, dt, 30);
    if (p.lungeT > 0) {
      // lunge carries momentum toward the ball
      const d = dist(p, ball) || 1;
      accel(p, ((ball.x - p.x) / d) * sp, ((ball.y - p.y) / d) * sp, dt, 60);
    }

    if (input.passEdge) {
      input.passEdge = false;
      if (has) {
        const dx = mag > 0.15 ? input.x / mag : p.fx;
        const dy = mag > 0.15 ? input.y / mag : p.fy;
        doPass(p, bestPassTarget(p, dx, dy));
      } else {
        const alt = nearest(0, (q) => q !== human);
        if (alt) {
          human = alt;
          switchCD = 0.8;
        }
      }
    }
    if (input.shootHeld) input.shootT += dt;
    if (has && input.shootRelease) {
      const power = clamp(0.22 + input.shootT / 0.8, 0.22, 1);
      shoot(p, power, mag > 0.15 ? input.y / Math.max(1, mag) : (Math.random() - 0.5) * 1.4);
      input.shootT = 0;
    }
    if (!has && input.shootEdge && p.tackleCD <= 0) {
      p.lungeT = 0.32;
      p.tackleCD = 0.7;
    }
    input.shootRelease = false;
    input.shootEdge = false;
    if (!has && p.lungeT > 0 && ball.owner && ball.owner.team === 1 && dist(p, ball) < 1.15) {
      p.lungeT = 0;
      if (Math.random() < 0.72) {
        steal(p);
        say('tackle');
      } else {
        const o = ball.owner;
        kick(o, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 1.5, 0.2);
        ball.lastTouch = 0;
      }
    }
  }

  function aiCarry(p, dt) {
    const dir = attackDir(p.team);
    const gx = p.team === 0 ? L : 0;
    p.decT -= dt;
    const dGoal = Math.hypot(gx - p.x, W / 2 - p.y);
    const opp = nearestOpp(p);
    const dOpp = opp ? dist(p, opp) : 99;
    const ahead = opp && (opp.x - p.x) * dir > -0.5;
    if (p.decT <= 0) {
      p.decT = 0.22 + Math.random() * 0.25;
      if (dGoal < 17 && Math.random() < 0.3 + (17 - dGoal) / 24) {
        shoot(p, 0.42 + Math.random() * 0.5, Math.random() * 2 - 1);
        return;
      }
      if (dOpp < 2.9 && ahead && Math.random() < 0.55) {
        const t = bestPassTarget(p);
        if (t) {
          doPass(p, t);
          return;
        }
      }
      p.weave = (Math.random() * 2 - 1) * 5;
    }
    let ty = W / 2 + p.weave;
    if (opp && dOpp < 4 && ahead) ty = p.y + (p.y >= opp.y ? 4.5 : -4.5);
    steerTo(p, gx, clamp(ty, 2, W - 2), AI_SPEED * 0.9, dt);
  }

  function aiOutfield(p, dt, chaser) {
    const team = p.team;
    const dir = attackDir(team);
    if (ball.owner === p) return aiCarry(p, dt);
    const ownPoss = ball.owner && ball.owner.team === team;
    if (p === chaser && !ownPoss) {
      const lead = clamp(dist(p, ball) / 9, 0, 0.5);
      steerTo(p, ball.x + ball.vx * lead, ball.y + ball.vy * lead, AI_SPEED, dt);
      if (ball.owner && ball.owner.team !== team && p.tackleCD <= 0 && dist(p, ball) < 0.95) {
        p.tackleCD = 0.75;
        if (Math.random() < (ball.owner === human ? 0.3 : 0.42)) {
          steal(p);
          if (!S.demo) say('tackle');
        }
      }
      return;
    }
    let tx = p.hx + (ball.x - L / 2) * 0.55 + (ownPoss ? dir * 6 : -dir * 1.5);
    const ty = clamp(p.hy + (ball.y - p.hy) * 0.32, 2.5, W - 2.5);
    if (p.role === 'DF') tx = team === 0 ? Math.min(tx, L * 0.52) : Math.max(tx, L * 0.48);
    steerTo(p, clamp(tx, 3, L - 3), ty, AI_SPEED * 0.82, dt);
  }

  function updateGK(g, dt) {
    const gx = g.team === 0 ? 0.9 : L - 0.9;
    const inward = attackDir(g.team);
    if (g.diveT > 0) g.diveT -= dt;
    if (ball.owner === g) {
      g.holdT -= dt;
      steerTo(g, gx + inward * 2, W / 2, 3, dt);
      if (g.holdT <= 0) {
        const t = bestPassTarget(g, inward, 0);
        doPass(g, t, true);
      }
      return;
    }
    let ty = clamp(W / 2 + (ball.y - W / 2) * 0.55, W / 2 - GOAL_W / 2 + 0.5, W / 2 + GOAL_W / 2 - 0.5);
    let tx = gx + inward * clamp(Math.abs(ball.x - gx) * 0.06, 0, 2);
    let speed = 4.6;
    const towardGoal = g.team === 0 ? ball.vx < -5 : ball.vx > 5;
    if (towardGoal && !ball.owner) {
      const tHit = (ball.x - gx) / -ball.vx;
      if (tHit > 0 && tHit < 1.5) {
        g.reactT += dt;
        if (g.reactT > 0.11) {
          ty = clamp(ball.y + ball.vy * tHit, W / 2 - GOAL_W / 2 - 0.4, W / 2 + GOAL_W / 2 + 0.4);
          tx = gx;
          speed = 7.4;
          if (Math.abs(ty - g.y) > 1.3 && g.diveT <= 0) {
            g.diveT = 0.55;
            g.diveDir = Math.sign(ty - g.y);
          }
        }
      }
    } else g.reactT = 0;
    // claim loose balls in the box
    if (!ball.owner && Math.abs(ball.x - gx) < 6.5 && Math.abs(ball.y - W / 2) < 7.5) {
      const others = players.filter((p) => p !== g && dist(p, ball) < dist(g, ball));
      if (!others.length) {
        tx = ball.x;
        ty = ball.y;
        speed = 6;
      }
    }
    steerTo(g, tx, ty, speed, dt);

    if (!ball.owner && ball.noCatch !== g) {
      const d = Math.hypot(ball.x - g.x, ball.y - g.y);
      const reach = g.diveT > 0 ? 1.7 : 1.15;
      if (d < reach && ball.z < 2.5) {
        const sp = Math.hypot(ball.vx, ball.vy);
        const corner = Math.abs(ball.y - W / 2) > GOAL_W / 2 - 1.1;
        if (sp > 22 && corner && Math.random() < 0.45) {
          ball.noCatch = g; // beaten at full stretch
          ball.noCatchT = 0.5;
          return;
        }
        if (sp > 23 && Math.random() < 0.42) {
          ball.vx = -ball.vx * 0.32;
          ball.vy += (Math.random() - 0.5) * 9;
          ball.vz = 2.6;
          ball.noCatch = g;
          ball.noCatchT = 0.4;
          ball.lastTouch = g.team;
        } else {
          takeBall(g);
          g.holdT = 0.95;
        }
        snd.save?.();
        say('save', true);
        S.lastShot = null;
      }
    }
  }

  // ── ball physics ─────────────────────────────────────────────────────────
  function updateBall(dt) {
    if (ball.noCatchT > 0) {
      ball.noCatchT -= dt;
      if (ball.noCatchT <= 0) ball.noCatch = null;
    }
    const o = ball.owner;
    if (o) {
      if (o.role === 'GK' && o.holdT > 0) {
        ball.x = o.x + o.fx * 0.25;
        ball.y = o.y;
        ball.z = 0.9;
        ball.vx = ball.vy = ball.vz = 0;
        return;
      }
      const tx = o.x + o.fx * 0.62;
      const ty = o.y + o.fy * 0.62;
      const k = Math.min(1, dt * 16);
      ball.x += (tx - ball.x) * k;
      ball.y += (ty - ball.y) * k;
      ball.z = 0;
      ball.vx = o.vx;
      ball.vy = o.vy;
      ball.spin += Math.hypot(o.vx, o.vy) * dt;
      const inMouth = Math.abs(ball.y - W / 2) < GOAL_W / 2 - 0.3;
      ball.y = clamp(ball.y, 0.25, W - 0.25);
      if (!inMouth) ball.x = clamp(ball.x, 0.25, L - 0.25);
      return;
    }
    if (ball.z > 0 || ball.vz > 0) {
      ball.vz -= GRAV * dt;
      ball.z += ball.vz * dt;
      const drag = Math.exp(-0.16 * dt);
      ball.vx *= drag;
      ball.vy *= drag;
      if (ball.z <= 0) {
        ball.z = 0;
        if (ball.vz < -2.2) {
          if (ball.vz < -3.5) snd.bounce?.();
          ball.vz = -ball.vz * 0.42;
          ball.vx *= 0.86;
          ball.vy *= 0.86;
        } else ball.vz = 0;
      }
    } else {
      const sp = Math.hypot(ball.vx, ball.vy);
      if (sp > 0) {
        const f = Math.max(0, sp - ROLL_DECEL * dt) / sp;
        ball.vx *= f;
        ball.vy *= f;
      }
    }
    const px = ball.x;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.spin += Math.hypot(ball.vx, ball.vy) * dt;
    // woodwork
    for (const gx of [0, L]) {
      if ((px - gx) * (ball.x - gx) <= 0 && px !== ball.x) {
        for (const py of [W / 2 - GOAL_W / 2, W / 2 + GOAL_W / 2]) {
          if (Math.abs(ball.y - py) < 0.32 && ball.z < GOAL_H) {
            ball.x = px;
            ball.vx = -ball.vx * 0.6;
            ball.vy += (ball.y - py) * 6;
            snd.post?.();
            say('post', true);
            S.shake = 0.25;
            return;
          }
        }
        if (Math.abs(ball.y - W / 2) < GOAL_W / 2 && Math.abs(ball.z - GOAL_H) < 0.28) {
          ball.x = px;
          ball.vx = -ball.vx * 0.5;
          ball.vz = -Math.abs(ball.vz) * 0.4;
          snd.post?.();
          say('post', true);
          S.shake = 0.25;
          return;
        }
      }
    }
  }

  function inGoal() {
    if (S.phase !== 'goal') return;
    const left = ball.x < L / 2;
    const back = left ? -GOAL_D + 0.25 : L + GOAL_D - 0.25;
    if (left ? ball.x < back : ball.x > back) {
      ball.x = back;
      ball.vx *= -0.15;
    }
    ball.y = clamp(ball.y, W / 2 - GOAL_W / 2 + 0.25, W / 2 + GOAL_W / 2 - 0.25);
    if (ball.z > GOAL_H - 0.2) {
      ball.z = GOAL_H - 0.2;
      ball.vz = Math.min(0, ball.vz);
    }
  }

  function checkPossession() {
    if (ball.owner || ball.z > 1.0) return;
    let best = null;
    let bd = 0.78;
    for (const p of players) {
      if (p.role === 'GK' || p === ball.noCatch || p.kickT > 0) continue;
      const d = Math.hypot(ball.x - (p.x + p.fx * 0.3), ball.y - (p.y + p.fy * 0.3));
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (!best) return;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > 17.5 && Math.random() < 0.5) {
      ball.vx *= -0.3;
      ball.vy = (Math.random() - 0.5) * 6;
      ball.noCatch = best;
      ball.noCatchT = 0.25;
      ball.lastTouch = best.team;
      return;
    }
    takeBall(best);
  }

  function checkBounds() {
    const inMouth = Math.abs(ball.y - W / 2) < GOAL_W / 2 && ball.z < GOAL_H;
    if (ball.x < 0) return inMouth ? goalScored(1) : endLine(0);
    if (ball.x > L) return inMouth ? goalScored(0) : endLine(1);
    if (ball.y < -0.25 || ball.y > W + 0.25) return throwIn();
  }

  function restart(kind, holder, spot) {
    ball.owner = null;
    ball.vx = ball.vy = ball.vz = 0;
    ball.z = 0;
    ball.x = spot.x;
    ball.y = spot.y;
    holder.x = spot.x;
    holder.y = spot.y;
    holder.vx = holder.vy = 0;
    takeBall(holder);
    if (holder.role === 'GK') holder.holdT = 0.9;
    S.phase = 'restart';
    S.phaseT = 0.7;
    if (!S.demo) say(kind, true);
    banner(kind === 'throwin' ? 'THROW-IN' : 'GOAL KICK', 0.9, 2);
  }

  function endLine(defTeam) {
    if (S.lastShot && S.time - S.lastShot.t < 3 && S.lastShot.team !== defTeam && !S.demo) {
      say(ball.z > GOAL_H ? 'over' : 'wide', true);
      snd.groan?.();
    }
    S.lastShot = null;
    const gk = gkOf(defTeam);
    restart('goalkick', gk, { x: defTeam === 0 ? 2.5 : L - 2.5, y: W / 2 });
  }

  function throwIn() {
    const team = 1 - ball.lastTouch;
    const spot = { x: clamp(ball.x, 2, L - 2), y: ball.y < 0 ? 0.3 : W - 0.3 };
    let taker = null;
    let bd = Infinity;
    for (const p of players) {
      if (p.team !== team || p.role === 'GK') continue;
      const d = Math.hypot(p.x - spot.x, p.y - spot.y);
      if (d < bd) {
        bd = d;
        taker = p;
      }
    }
    restart('throwin', taker, spot);
  }

  function goalScored(team) {
    S.score[team] += 1;
    ball.owner = null;
    S.phase = 'goal';
    S.phaseT = 3.1;
    S.kickoffTeam = 1 - team;
    S.celebrate = team;
    S.lastShot = null;
    S.shake = 0.45;
    banner('GOAL!', 2.6, 4);
    snd.goal?.();
    if (!S.demo) say(team === 0 ? 'goal0' : 'goal1', true);
    onEvent({ type: 'goal', team, score: [...S.score], demo: S.demo });
  }

  function setupKickoff(team) {
    S.celebrate = -1;
    for (const p of players) {
      const own = p.team === 0 ? Math.min(p.hx, L / 2 - 3) : Math.max(p.hx, L / 2 + 3);
      p.x = p.role === 'GK' ? p.hx : own;
      p.y = p.hy;
      p.vx = p.vy = 0;
      p.fx = attackDir(p.team);
      p.fy = 0;
      p.holdT = 0;
      p.diveT = 0;
      p.jump = 0;
    }
    const kicker = players.find((p) => p.team === team && p.role === 'ML');
    kicker.x = L / 2 - attackDir(team) * 0.7;
    kicker.y = W / 2;
    ball.owner = null;
    ball.x = L / 2;
    ball.y = W / 2;
    ball.z = 0;
    ball.vx = ball.vy = ball.vz = 0;
    S.kickoffTeam = team;
    S.phase = 'kickoff';
    S.phaseT = 1.1;
    S.camX = L / 2;
  }

  // ── public controls ─────────────────────────────────────────────────────
  function startMatch() {
    S.demo = false;
    S.paused = false;
    S.score = [0, 0];
    S.clock = 0;
    human = null;
    setupKickoff(0);
    banner('KICK OFF', 1.4, 3);
    say('kickoff', true);
    crowd.start?.();
    onEvent({ type: 'start' });
  }
  function startDemo() {
    S.demo = true;
    S.paused = false;
    S.score = [0, 0];
    S.clock = 0;
    human = null;
    setupKickoff(Math.random() < 0.5 ? 0 : 1);
    S.ticker = { text: pick(LINES.demo), shown: 0, at: S.time };
  }
  function fullTime() {
    S.phase = 'fulltime';
    S.phaseT = 99;
    ball.owner = null;
    S.banner = null; // the DOM overlay owns the full-time screen
    say('fulltime', true);
    snd.whistle?.(3);
    crowd.stop?.();
    onEvent({ type: 'fulltime', score: [...S.score] });
  }

  // ── update loop ─────────────────────────────────────────────────────────
  function play(dt) {
    for (const p of players) {
      p.kickT = Math.max(0, p.kickT - dt);
      p.tackleCD = Math.max(0, p.tackleCD - dt);
      p.lungeT = Math.max(0, p.lungeT - dt);
    }
    switchCD -= dt;
    if (!S.demo) chooseHuman();
    const ownPoss0 = ball.owner && ball.owner.team === 0;
    const ownPoss1 = ball.owner && ball.owner.team === 1;
    const chaser = [S.demo && !ownPoss0 ? nearest(0) : null, !ownPoss1 ? nearest(1) : null];
    for (const p of players) {
      if (p === human && !S.demo) controlHuman(p, dt);
      else if (p.role === 'GK') updateGK(p, dt);
      else aiOutfield(p, dt, chaser[p.team]);
      integrate(p, dt);
    }
    separate();
    updateBall(dt);
    checkPossession();
    checkBounds();
  }

  function update(dt) {
    S.time += dt;
    if (S.banner) {
      S.banner.t -= dt;
      if (S.banner.t <= 0) S.banner = null;
    }
    S.ticker.shown = Math.min(S.ticker.text.length, S.ticker.shown + dt * 42);
    S.shake = Math.max(0, S.shake - dt);
    if (S.paused) return;
    switch (S.phase) {
      case 'kickoff':
        S.phaseT -= dt;
        for (const p of players) {
          accel(p, 0, 0, dt);
          integrate(p, dt);
        }
        if (S.phaseT <= 0) {
          S.phase = S.demo ? 'demo' : 'play';
          if (!S.demo) snd.whistle?.(1);
          takeBall(players.find((p) => p.team === S.kickoffTeam && p.role === 'ML'));
        }
        break;
      case 'play':
        S.clock += dt;
        if (S.clock >= MATCH_LEN) {
          fullTime();
          break;
        }
        play(dt);
        break;
      case 'demo':
        play(dt);
        break;
      case 'restart':
        S.phaseT -= dt;
        for (const p of players) {
          if (p !== ball.owner) {
            accel(p, 0, 0, dt);
            integrate(p, dt);
          }
        }
        updateBall(dt);
        if (S.phaseT <= 0) S.phase = S.demo ? 'demo' : 'play';
        break;
      case 'goal':
        S.phaseT -= dt;
        updateBall(dt);
        inGoal();
        for (const p of players) {
          if (p.team === S.celebrate) {
            p.jump = Math.abs(Math.sin(S.time * 9 + p.idx)) * 0.45;
            steerTo(p, p.team === 0 ? L * 0.62 : L * 0.38, W * 0.85, 4, dt);
          } else accel(p, 0, 0, dt);
          integrate(p, dt);
        }
        if (S.phaseT <= 0) setupKickoff(S.kickoffTeam);
        break;
      case 'fulltime':
        for (const p of players) {
          accel(p, 0, 0, dt);
          integrate(p, dt);
        }
        break;
      default:
        break;
    }
    // camera follows the ball with a little look-ahead
    const half = VW / 2 / PPM;
    const target = clamp(ball.x + ball.vx * 0.22, half - 3, L - half + 3);
    S.camX += (target - S.camX) * Math.min(1, dt * 3.2);
  }

  // ── rendering ───────────────────────────────────────────────────────────
  const P = (x, y, z = 0) => project(x, y, z, S.camX);

  function pxLine(x0, y0, x1, y1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let guard = 0;
    for (;;) {
      if (x0 >= -1 && x0 <= VW && y0 >= 0 && y0 <= VH) ctx.fillRect(x0, y0, 1, 1);
      if ((x0 === x1 && y0 === y1) || ++guard > 2000) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  const wline = (x0, y0, x1, y1, z0 = 0, z1 = z0) => {
    const a = P(x0, y0, z0);
    const b = P(x1, y1, z1);
    if ((a.x < -40 && b.x < -40) || (a.x > VW + 40 && b.x > VW + 40)) return;
    pxLine(a.x, a.y, b.x, b.y);
  };
  function quad(x0, y0, x1, y1, color) {
    const a = P(x0, y0);
    const b = P(x1, y0);
    const c = P(x1, y1);
    const d = P(x0, y1);
    if (Math.max(a.x, b.x, c.x, d.x) < 0 || Math.min(a.x, b.x, c.x, d.x) > VW) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(Math.round(a.x), Math.round(a.y));
    ctx.lineTo(Math.round(b.x), Math.round(b.y));
    ctx.lineTo(Math.round(c.x), Math.round(c.y));
    ctx.lineTo(Math.round(d.x), Math.round(d.y));
    ctx.closePath();
    ctx.fill();
  }

  function drawStadium() {
    ctx.fillStyle = '#07080d';
    ctx.fillRect(0, 0, VW, VH);
    const off = ((-S.camX * PPM * 0.42) % crowdCv.width + crowdCv.width) % crowdCv.width;
    const bounce = S.phase === 'goal' && Math.floor(S.time * 10) % 2 ? -1 : 0;
    ctx.drawImage(crowdCv, Math.round(off - crowdCv.width), bounce);
    ctx.drawImage(crowdCv, Math.round(off), bounce);
    // ad boards
    const texts = ["PIXEL CUP '96", 'RNM-16', 'INSERT COIN', 'SCIENCE THAT SHIPS', 'PRESS START', 'MERN STACK'];
    const cols = ['#FFB627', '#EDEDED', '#3DE8FF', '#FFB627', '#FF3B5C', '#2FBF71'];
    const by = -2.4;
    for (let i = -2; i < 9; i++) {
      const x0 = i * 9;
      const a = P(x0, by, 0.95);
      const b = P(x0 + 9, by, 0);
      if (b.x < 0 || a.x > VW) continue;
      ctx.fillStyle = i % 2 ? '#101010' : '#181818';
      ctx.fillRect(Math.round(a.x), Math.round(a.y), Math.round(b.x - a.x), Math.round(b.y - a.y));
      ctx.fillStyle = '#000';
      ctx.fillRect(Math.round(a.x), Math.round(b.y), Math.round(b.x - a.x), 1);
      const tx = texts[(i + 20) % texts.length];
      const tw = measureText(tx);
      if (tw < b.x - a.x - 4) drawPixelText(ctx, tx, (a.x + b.x) / 2, a.y + 1, { color: cols[(i + 20) % cols.length], align: 'center' });
    }
  }

  function drawPitch() {
    // apron
    quad(-6, -1.6, L + 6, W + 4, '#1d5424');
    // mown stripes
    for (let i = 0; i < 16; i++) quad(i * 4, -0.8, i * 4 + 4, W + 0.8, i % 2 ? '#2c7a33' : '#328a39');
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    // touchlines, goal lines, halfway
    wline(0, 0, L, 0);
    wline(0, W, L, W);
    wline(0, 0, 0, W);
    wline(L, 0, L, W);
    wline(L / 2, 0, L / 2, W);
    // centre circle + spot
    let prev = null;
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      const p = P(L / 2 + Math.cos(a) * 5.5, W / 2 + Math.sin(a) * 5.5);
      if (prev) pxLine(prev.x, prev.y, p.x, p.y);
      prev = p;
    }
    const c = P(L / 2, W / 2);
    ctx.fillRect(Math.round(c.x), Math.round(c.y), 2, 1);
    // boxes
    for (const side of [0, 1]) {
      const gx = side ? L : 0;
      const s = side ? -1 : 1;
      const box = (depth, half) => {
        wline(gx, W / 2 - half, gx + s * depth, W / 2 - half);
        wline(gx + s * depth, W / 2 - half, gx + s * depth, W / 2 + half);
        wline(gx + s * depth, W / 2 + half, gx, W / 2 + half);
      };
      box(10, 10.5);
      box(3.6, 5.2);
      const sp = P(gx + s * 7.5, W / 2);
      ctx.fillRect(Math.round(sp.x), Math.round(sp.y), 2, 1);
      // corner arcs
      for (const cy of [0, W]) {
        let pr = null;
        for (let k = 0; k <= 6; k++) {
          const a = (k / 6) * (Math.PI / 2);
          const p = P(gx + s * Math.cos(a) * 1, cy + (cy ? -1 : 1) * Math.sin(a) * 1);
          if (pr) pxLine(pr.x, pr.y, p.x, p.y);
          pr = p;
        }
      }
    }
  }

  function drawGoalNet(side) {
    const gx = side ? L : 0;
    const back = side ? L + GOAL_D : -GOAL_D;
    const y0 = W / 2 - GOAL_W / 2;
    const y1 = W / 2 + GOAL_W / 2;
    ctx.fillStyle = 'rgba(220,225,235,0.32)';
    for (let y = y0; y <= y1 + 0.01; y += GOAL_W / 10) wline(back, y, back, y, 0, GOAL_H * 0.85);
    for (let z = 0; z <= GOAL_H * 0.85; z += 0.45) wline(back, y0, back, y1, z, z);
    for (let z = 0; z <= GOAL_H; z += 0.6) {
      wline(gx, y0, back, y0, z, Math.min(z, GOAL_H * 0.85));
      wline(gx, y1, back, y1, z, Math.min(z, GOAL_H * 0.85));
    }
    for (let k = 0; k <= 3; k++) {
      const x = gx + (back - gx) * (k / 3);
      wline(x, y0, x, y1, GOAL_H - (GOAL_H * 0.15 * k) / 3, GOAL_H - (GOAL_H * 0.15 * k) / 3);
    }
  }
  function drawGoalFrame(side) {
    const gx = side ? L : 0;
    const y0 = W / 2 - GOAL_W / 2;
    const y1 = W / 2 + GOAL_W / 2;
    ctx.fillStyle = '#FFFFFF';
    for (const y of [y0, y1]) {
      const a = P(gx, y, 0);
      const b = P(gx, y, GOAL_H);
      ctx.fillRect(Math.round(a.x) - 1, Math.round(b.y), 2, Math.round(a.y - b.y));
    }
    const a = P(gx, y0, GOAL_H);
    const b = P(gx, y1, GOAL_H);
    pxLine(a.x, a.y, b.x, b.y);
    pxLine(a.x, a.y - 1, b.x, b.y - 1);
  }

  function ellipse(cx, cy, rx, ry, color) {
    ctx.fillStyle = color;
    for (let j = -ry; j <= ry; j++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry || 1))));
      ctx.fillRect(Math.round(cx - w), Math.round(cy + j), w * 2 || 1, 1);
    }
  }

  function drawPlayer(p) {
    const base = P(p.x, p.y, 0);
    const lift = P(p.x, p.y, p.jump || 0);
    const u = base.s;
    const X = Math.round(base.x);
    const Y = Math.round(lift.y);
    if (X < -20 || X > VW + 20) return;
    const kit = KITS[p.team];
    const isGK = p.role === 'GK';
    const shirt = isGK ? kit.gk : kit.shirt;
    if (p === human && !S.demo) {
      ctx.fillStyle = 'rgba(255,182,39,0.9)';
      const rx = Math.round(5 * u);
      ellipse(X, Math.round(base.y), rx + 1, Math.max(1, Math.round(1.6 * u)), 'rgba(255,182,39,0.55)');
    }
    ellipse(X, Math.round(base.y), Math.round(4 * u), Math.max(1, Math.round(1.2 * u)), 'rgba(0,0,0,0.38)');

    if (isGK && p.diveT > 0) {
      // full-stretch dive
      const len = Math.round(15 * u);
      const thick = Math.max(3, Math.round(4 * u));
      const y = Y - Math.round(8 * u);
      const x0 = p.diveDir > 0 ? X - 3 : X - len + 3;
      ctx.fillStyle = shirt;
      ctx.fillRect(x0, y, len, thick);
      ctx.fillStyle = kit.shorts;
      ctx.fillRect(p.diveDir > 0 ? x0 : x0 + len - 4, y, 4, thick);
      ctx.fillStyle = p.skin;
      ctx.fillRect(p.diveDir > 0 ? x0 + len : x0 - 3, y, 3, thick - 1);
      return;
    }

    const moving = Math.hypot(p.vx, p.vy) > 0.6;
    const frame = moving ? Math.floor(p.anim * 2.4) % 4 : 0;
    const legH = Math.max(3, Math.round(7 * u));
    const legW = Math.max(1, Math.round(2 * u));
    const bw = Math.max(4, Math.round(7 * u));
    const shH = Math.max(2, Math.round(3.5 * u));
    const shirtH = Math.max(4, Math.round(7 * u));
    const off = [0, 1, 0, -1][frame] * Math.max(1, Math.round(u * 1.4));
    // legs + boots
    ctx.fillStyle = kit.socks;
    ctx.fillRect(X - legW - 1 + off, Y - legH, legW, legH);
    ctx.fillRect(X + 1 - off, Y - legH, legW, legH);
    ctx.fillStyle = p.skin;
    ctx.fillRect(X - legW - 1 + off, Y - legH, legW, Math.max(1, Math.round(legH * 0.3)));
    ctx.fillRect(X + 1 - off, Y - legH, legW, Math.max(1, Math.round(legH * 0.3)));
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(X - legW - 1 + off, Y - 1, legW + 1, 1);
    ctx.fillRect(X + 1 - off, Y - 1, legW + 1, 1);
    // shorts
    const top = Y - legH - shH;
    ctx.fillStyle = kit.shorts;
    ctx.fillRect(X - Math.floor(bw / 2), top, bw, shH);
    // shirt + arms
    const sTop = top - shirtH;
    ctx.fillStyle = shirt;
    ctx.fillRect(X - Math.floor(bw / 2), sTop, bw, shirtH);
    ctx.fillStyle = isGK ? kit.gk : kit.trim;
    ctx.fillRect(X - Math.floor(bw / 2), sTop, bw, 1);
    const armY = sTop + 1 + (moving && frame % 2 ? 1 : 0);
    ctx.fillStyle = shirt;
    ctx.fillRect(X - Math.floor(bw / 2) - legW, armY, legW, Math.max(2, Math.round(4 * u)));
    ctx.fillRect(X + Math.ceil(bw / 2), sTop + 1 + (moving && frame % 2 ? 0 : 1), legW, Math.max(2, Math.round(4 * u)));
    ctx.fillStyle = p.skin;
    ctx.fillRect(X - Math.floor(bw / 2) - legW, armY + Math.max(2, Math.round(4 * u)), legW, Math.max(1, Math.round(1.5 * u)));
    ctx.fillRect(X + Math.ceil(bw / 2), sTop + 1 + Math.max(2, Math.round(4 * u)), legW, Math.max(1, Math.round(1.5 * u)));
    // head + hair
    const hw = Math.max(3, Math.round(4.4 * u));
    const hh = Math.max(3, Math.round(4.4 * u));
    const hx = X - Math.floor(hw / 2);
    const hy = sTop - hh;
    ctx.fillStyle = p.skin;
    ctx.fillRect(hx, hy, hw, hh);
    ctx.fillStyle = p.hair;
    ctx.fillRect(hx, hy, hw, Math.max(1, Math.round(1.6 * u)));
    ctx.fillRect(p.fx >= 0 ? hx : hx + hw - 1, hy, 1, Math.max(2, Math.round(2.6 * u)));

    if (p === human && !S.demo) {
      const bob = Math.round(Math.sin(S.time * 8) * 1.5);
      ctx.fillStyle = '#FFB627';
      const ay = hy - 7 + bob;
      ctx.fillRect(X - 3, ay, 7, 1);
      ctx.fillRect(X - 2, ay + 1, 5, 1);
      ctx.fillRect(X - 1, ay + 2, 3, 1);
      ctx.fillRect(X, ay + 3, 1, 1);
      if (input.shootHeld && ball.owner === p) {
        const pw = clamp(0.22 + input.shootT / 0.8, 0.22, 1);
        ctx.fillStyle = '#000';
        ctx.fillRect(X - 9, ay - 6, 19, 4);
        ctx.fillStyle = pw > 0.85 ? '#FF3B5C' : '#FFB627';
        ctx.fillRect(X - 8, ay - 5, Math.round(17 * pw), 2);
      }
    }
  }

  function drawBall() {
    const g = P(ball.x, ball.y, 0);
    const b = P(ball.x, ball.y, ball.z);
    if (b.x < -10 || b.x > VW + 10) return;
    const sh = Math.max(1, Math.round(2.4 * g.s * (1 - Math.min(ball.z, 6) / 10)));
    ellipse(Math.round(g.x), Math.round(g.y), sh + 1, 1, 'rgba(0,0,0,0.45)');
    const r = b.s > 0.8 ? 2 : 1;
    const X = Math.round(b.x);
    const Y = Math.round(b.y) - r - 1;
    ctx.fillStyle = '#111';
    ctx.fillRect(X - r - 1, Y - r, (r + 1) * 2 + 1, r * 2 + 1);
    ctx.fillRect(X - r, Y - r - 1, r * 2 + 1, (r + 1) * 2 + 1);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(X - r, Y - r, r * 2 + 1, r * 2 + 1);
    const ph = Math.floor(ball.spin * 3) % 4;
    ctx.fillStyle = '#222';
    ctx.fillRect(X - r + (ph % 2) * r, Y - r + (ph > 1 ? r : 0), 1, 1);
  }

  function drawRadar() {
    const rw = 68;
    const rh = 43;
    const rx = VW - rw - 6;
    const ry = 6;
    ctx.fillStyle = 'rgba(4,20,8,0.78)';
    ctx.fillRect(rx - 1, ry - 1, rw + 2, rh + 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(rx, ry, rw, 1);
    ctx.fillRect(rx, ry + rh - 1, rw, 1);
    ctx.fillRect(rx, ry, 1, rh);
    ctx.fillRect(rx + rw - 1, ry, 1, rh);
    ctx.fillRect(rx + Math.round(rw / 2), ry, 1, rh);
    const mx = (x) => rx + Math.round((x / L) * (rw - 1));
    const my = (y) => ry + Math.round((y / W) * (rh - 1));
    // camera window
    const half = VW / 2 / PPM;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(mx(S.camX - half), ry + 1, Math.round(((half * 2) / L) * rw), rh - 2);
    for (const p of players) {
      ctx.fillStyle = p === human && !S.demo ? '#FFFFFF' : p.team === 0 ? KITS[0].shirt : '#FF3B5C';
      ctx.fillRect(mx(p.x) - 1, my(p.y) - 1, 2, 2);
    }
    if (Math.floor(S.time * 6) % 2 === 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(mx(ball.x), my(ball.y), 1, 1);
    }
  }

  function drawHUD() {
    // scoreboard
    const left = TEAMS.home.short;
    const right = TEAMS.away.short;
    const txt = `${S.score[0]}-${S.score[1]}`;
    const w = 6 + 3 + measureText(left) + 6 + measureText(txt) + 6 + measureText(right) + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(6, 6, w, 13);
    ctx.fillStyle = KITS[0].shirt;
    ctx.fillRect(8, 9, 3, 7);
    let x = 14;
    drawPixelText(ctx, left, x, 9, { color: '#FFFFFF' });
    x += measureText(left) + 6;
    drawPixelText(ctx, txt, x, 9, { color: '#FFB627' });
    x += measureText(txt) + 6;
    drawPixelText(ctx, right, x, 9, { color: '#FFFFFF' });
    ctx.fillStyle = '#FF3B5C';
    ctx.fillRect(6 + w - 5, 9, 3, 7);
    const clockTxt = S.demo ? 'DEMO' : `${Math.min(90, Math.floor((S.clock / MATCH_LEN) * 90))}'`;
    const cw = measureText(clockTxt) + 8;
    ctx.fillStyle = S.demo ? 'rgba(255,59,92,0.85)' : 'rgba(255,182,39,0.92)';
    ctx.fillRect(6 + w + 2, 6, cw, 13);
    drawPixelText(ctx, clockTxt, 6 + w + 6, 9, { color: '#000000' });

    drawRadar();

    // commentary ticker
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, VH - 15, VW, 15);
    ctx.fillStyle = '#FFB627';
    ctx.fillRect(0, VH - 15, 3, 15);
    const shown = S.ticker.text.slice(0, Math.floor(S.ticker.shown));
    drawPixelText(ctx, `> ${shown}`, 9, VH - 11, { color: '#F2EEE6' });
    if (Math.floor(S.time * 3) % 2 === 0 && S.ticker.shown < S.ticker.text.length + 1) {
      ctx.fillStyle = '#FFB627';
      ctx.fillRect(9 + measureText(`> ${shown}`) + 2, VH - 11, 4, 7);
    }

    if (S.banner) {
      const { text, scale } = S.banner;
      const flash = Math.floor(S.time * 8) % 2 === 0;
      const col = text === 'GOAL!' ? (flash ? '#FFB627' : '#FFFFFF') : '#FFFFFF';
      const bw = measureText(text) * scale;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(VW / 2 - bw / 2 - 10, 110 - 6, bw + 20, 7 * scale + 12);
      drawPixelText(ctx, text, VW / 2, 110, { scale, color: col, align: 'center', shadow: '#000' });
    }
  }

  function render() {
    const sx = S.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
    ctx.setTransform(1, 0, 0, 1, sx, 0);
    drawStadium();
    drawPitch();
    drawGoalNet(0);
    drawGoalNet(1);
    const ents = players.map((p) => ({ y: p.y, p }));
    ents.push({ y: ball.y + 0.05, ball: true });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) (e.ball ? drawBall() : drawPlayer(e.p));
    drawGoalFrame(0);
    drawGoalFrame(1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawHUD();
  }

  // ── loop ────────────────────────────────────────────────────────────────
  let raf = 0;
  let running = false;
  let last = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.034, (now - last) / 1000 || 0.016);
    last = now;
    update(dt);
    render();
  }

  startDemo();
  render();

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    startMatch,
    startDemo,
    setPaused(v) {
      S.paused = !!v;
      if (v) crowd.stop?.();
      else if (!S.demo && S.phase !== 'fulltime') crowd.start?.();
    },
    setStick(x, y) {
      input.x = clamp(x, -1, 1);
      input.y = clamp(y, -1, 1);
    },
    press(btn) {
      if (btn === 'pass') input.passEdge = true;
      if (btn === 'shoot') {
        if (!input.shootHeld) {
          input.shootEdge = true;
          input.shootT = 0;
        }
        input.shootHeld = true;
      }
    },
    release(btn) {
      if (btn === 'shoot' && input.shootHeld) {
        input.shootHeld = false;
        input.shootRelease = true;
      }
    },
    getState: () => ({ phase: S.phase, demo: S.demo, score: [...S.score], clock: S.clock, paused: S.paused }),
    renderOnce: render,
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      crowd.stop?.();
    },
  };
}
