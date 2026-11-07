# RUDRA.ROM — portfolio of Rudra Narayan Mondal

An arcade-editorial portfolio on the MERN stack: a PS1-style console power-on, a CRT-lit black
site set in pixel type and serif italics, a dithered 3D helix, a TV that zooms into your
abilities, cartridge-box case studies, a hall of fame, and **PIXEL CUP '96**, a playable
4-a-side football game with a MongoDB leaderboard.

```
client/   React 19 + Vite · GSAP/ScrollTrigger · Lenis · Three.js   (prebuilt in client/dist)
server/   Express 5 + Mongoose · contact form · leaderboard · visitor counter · content API
server/data/content.json   ← every word on the site lives here
```

---

## 1 · Get it onto the Legion

From your phone, use the Tailscale app's **"Select a file to send it to this device"** on
`rudra-cser-legion-5-pro-16ach6h` and pick `rudra-portfolio.zip`. On Linux, Taildrop files
wait in an inbox until you collect them:

```bash
sudo tailscale file get ~/Downloads
mkdir -p ~/Projects && unzip ~/Downloads/rudra-portfolio.zip -d ~/Projects
cd ~/Projects/rudra-portfolio
```

## 2 · Run it

Needs **Node 20.19+ or 22** (`node -v`). If Ubuntu's Node is older:
`curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash && nvm install 22`

```bash
cp .env.example .env          # edit if you like — works as-is
npm install                   # installs client + server (npm workspaces)
npm start                     # serves the prebuilt site + API on :5000
```

The server prints its URLs. From any device on your tailnet:
**http://rudra-cser-legion-5-pro-16ach6h.tailb05102.ts.net:5000** (or `http://100.121.208.108:5000`).
If `ufw` is on: `sudo ufw allow in on tailscale0 to any port 5000`.

Development (hot reload on :5173, API proxied to :5000): `npm run dev`
After editing anything in `client/`: `npm run build`, then restart.

## 3 · MongoDB (optional — it runs without it)

With no reachable `MONGODB_URI` the server falls back to **file mode** (JSON in
`server/storage/`), so nothing breaks. For the real MERN setup, pick one:

```bash
docker compose up -d mongo     # local Mongo on 127.0.0.1:27017 (matches .env.example)
# or put an Atlas URI in .env:  MONGODB_URI=mongodb+srv://…
npm start                      # first start seeds content + projects into Mongo
```

What Mongo stores: site content and projects, contact messages, PIXEL CUP scores (points are
computed on the server from the result, never trusted from the browser), the visitor counter.

## 4 · Keep it running ("constant")

**pm2** (simplest):

```bash
npm install -g pm2                   # add sudo if Node came from apt rather than nvm
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup              # run the command it prints, once
```

**or systemd** (no extra tools): see `deploy/rudra-portfolio.service`. If Node came from nvm,
replace `/usr/bin/env node` in `ExecStart` with the output of `which node`.

## 5 · HTTPS link before the domain exists

```bash
sudo tailscale serve --bg 5000       # tailnet-only:  https://rudra-cser-legion-5-pro-16ach6h.tailb05102.ts.net
sudo tailscale funnel --bg 5000      # public internet, same URL
tailscale funnel status
sudo tailscale funnel reset          # stop public access   (tailscale serve reset for the tailnet one)
```

If HTTPS certificates or Funnel aren't enabled for your tailnet yet, the CLI prints a link to
turn them on. Once Tailscale fronts the site, set `HOST=127.0.0.1` in `.env` so port 5000 is no
longer open on campus/hostel Wi-Fi — the site stays reachable through the Tailscale URL.

When you go public with Funnel, set `SITE_URL=https://rudra-cser-legion-5-pro-16ach6h.tailb05102.ts.net`
in `.env` and restart.

## 6 · When the domain is decided

1. `.env` → `SITE_URL=https://yourdomain` (canonical + Open Graph tags update at serve time)
2. `server/data/content.json` → `"person.domain": "yourdomain"` (footer)
3. `npm run build && npm run seed` (seed only if using Mongo), restart.

---

## Editing content

Everything — bio, abilities, projects, hall of fame, marquees, links — is in
**`server/data/content.json`**. After editing: `npm run build` (the client bundles a copy so the
site renders instantly) and `npm run seed` if you use Mongo.

- **Email / LinkedIn / X:** fill `person.email` and `person.links.*`; empty values stay hidden.
- **Resume:** drop `server/public/resume.pdf`; the RESUME link appears automatically.
- **Project screenshots:** set a project's `"image"` (e.g. `"/shots/setu.png"`, placed in
  `server/public/shots/`) to replace its pixel cartridge art.
- **Live / source links:** `liveUrl`, `sourceUrl` per project; the buttons adapt.

## Reading contact messages

```bash
npm run messages            # latest 20 (works in Mongo or file mode)
npm run messages -- 100
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:5000/api/admin/messages
```

## API

| Method | Path | |
|---|---|---|
| GET | `/api/health` | mode + host info (feeds the title screen's SERVED FROM line) |
| GET | `/api/content` | site content + projects |
| POST | `/api/contact` | `{ email, message, name? }` — rate-limited, honeypot-protected |
| GET / POST | `/api/scores` | top 10 / `{ initials, gf, ga }` |
| GET / POST | `/api/visits` | visitor counter |
| GET | `/api/admin/messages` | needs `ADMIN_TOKEN` |

## Phones

At phone widths (and phones held sideways) the site switches to **chapter mode**: a sticky
category bar (BIO · SKILLS · QUESTS · FAME · PLAY · CONTACT) that follows your scroll, short
numbered chapters that snap into place, abilities as swipeable TV channels, and projects as a
swipeable deck. Desktop keeps the long-form scroll story. The chapter titles and kickers live in
`content.json` under `mobile.chapters`, and the short bio under `about.short`.

## The opening

The site opens in a 1999 bedroom drawn the way a PlayStation-era game would draw it: a tiny
software renderer (`client/src/intro/`, no WebGL) paints low-poly 3D into a ~270-pixel-tall
picture, with polygons that wobble as they snap to whole pixels, dithered 15-bit colour,
depth fog and textures mapped without perspective correction. It runs at 30 fps and drops
to a coarser picture by itself if a device struggles.

1. **Standby.** An original grey console (the "RNM-16") and its pad on the carpet, a CRT TV
   above, START glowing. Nothing happens until a tap, click or key press (or 9 seconds pass),
   because browsers only allow sound after a gesture.
2. **Power on.** The switch clicks, the light turns green, the disc spins up, and the tube
   warms up from a dot to a line to a white screen. Its light now fills the room.
3. **Boot logo.** A voxel R flies in and lands over a rising synth chord: RNM-16 ENTERTAINMENT SYSTEM.
4. **Title screen.** RUDRA · SOFTWARE ENGINEER · PRESS START, plus the server it's coming
   from. START is accepted and the camera dives into the glass.
5. **Into the site.** The picture switches on like a CRT, opening out from a bright line.

The full run is about 6 seconds after the tap. A second tap, **Esc** or SKIP INTRO goes
straight in; a reload in the same tab gets a 2-second version. The console, logo and sounds
are original; nothing is taken from Sony's PlayStation boot screen. Camera shots are in
`intro/engine.js` (`SHOTS`), the timing in `components/Boot.jsx`, the TV picture in
`intro/screen.js`, the room in `intro/room.js`.

## Soundtrack

Seven original chiptune songs, written for this site and synthesized live in the browser with
Web Audio, so there are no audio files to host or license. The playlist is shuffled per visit (and
never opens on the song you heard last), then the songs play back to back.

| # | Song | Feel | Tempo | Length |
|---|---|---|---|---|
| 01 | NEON KART | racing | 152 bpm | 1:00 |
| 02 | PIXEL HARBOR | island, swung | 116 bpm | 1:02 |
| 03 | LAB NIGHT | chill, swung | 86 bpm | 1:18 |
| 04 | BOSS RUSH | intense | 172 bpm | 0:50 |
| 05 | CLOUD KINGDOM | waltz (3/4) | 138 bpm | 0:47 |
| 06 | DESERT CIRCUIT | racing | 144 bpm | 0:53 |
| 07 | CREDITS ROLL | nostalgic | 100 bpm | 1:07 |

- Nothing plays until the visitor's first tap, click or key (browsers require a gesture),
  and the playlist waits for the opening to finish.
- The header speaker mutes everything. The pause menu (**P**, or the ring button) has
  MUSIC on/off on its own and a TRACK button that skips; on wide screens the now-playing chip in
  the header skips too.
- The music steps aside during a PIXEL CUP match (crowd and whistle take over), comes back at
  full time, and pauses while the tab is hidden.
- Songs live in `client/src/lib/tracks.js` as plain text: `E5:2` is a note two steps long, `.` a
  rest, `|` a bar line. Every bar is checked when a song loads, so a miscount fails loudly. Copy a
  track object and change the notes to add a song; it joins the shuffle automatically.
- Overall music volume is `LEVEL` in `client/src/lib/music.js`.

## Things to try on the site

- **P** opens the pause menu: sound, music, track skip, CRT effects, palettes (ARCADE · PHOSPHOR · CGA · POCKET).
- **↑ ↑ ↓ ↓ ← → ← → B A** anywhere.
- PIXEL CUP controls: arrows/WASD move · **Z** pass/switch · hold **X** (or Space) to shoot, tap to tackle · **P** pause. Touch devices get a gamepad.
- `?match=10` shortens a match for testing (it can only make matches shorter).
- Achievements are stored per browser; clear site data to replay them.

Everything respects `prefers-reduced-motion`: the opening is skipped, pins and scrubbing are
disabled, and the abilities TV gets ◀ ▶ buttons instead.
