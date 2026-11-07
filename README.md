# RUDRA.ROM

The personal portfolio of **Rudra Narayan Mondal**, a software engineer at CRTDH Lab, IIT Kharagpur,
working on machine learning for biological data and biomarker quantification for point-of-care devices.

The site is built like a late-90s console game. It powers on in a low-poly bedroom, boots a fictional
"RNM-16" console, then dives through the CRT into a dark, pixel-type editorial site: abilities on a
zooming TV, projects as cartridge boxes, a hall of fame, and **PIXEL CUP '96**, a playable 4-a-side
football game with a global leaderboard.

## What's inside

- **The opening.** A small software renderer (no WebGL) draws PS1-style low-poly 3D: vertices that
  snap to whole pixels, dithered 15-bit colour, depth fog and textures without perspective correction.
- **An original chiptune soundtrack.** Seven songs synthesized live in the browser with the Web Audio
  API, so there are no audio files.
- **PIXEL CUP '96.** A canvas football game with a broadcast camera, a radar and commentary. Points
  are computed on the server, never trusted from the browser.
- **Phone chapter mode.** On phones the long scroll story becomes short, swipeable chapters.
- **NO SIGNAL.** On a slow or lost connection the logotype drifts around the screen like an old TV
  screensaver, and the site picks itself back up when the connection returns.
- A pause menu, colour palettes and a few secrets for those who look.

## How it's built

**Client.** React 19 and Vite, GSAP with ScrollTrigger for scroll-driven motion, Lenis for smooth
scrolling, and Three.js for the hero helix and the TV picture. All content arrives in a single JSON
request, and every section sits behind an error boundary, so one failure never blanks the page.

**Server.** Everything the site says lives in a folder of JSON files, checked against a schema and
served as one response. The site runs on Cloudflare: the React build is served as static files from
the edge, the API runs as a Cloudflare Worker, and the only data visitors create (leaderboard scores
and a visitor count) lives in Cloudflare D1. The same API also runs as a Node.js and Express 5 server,
keeping that data in small JSON files written atomically. Both share one set of models and rules, send
a strict Content Security Policy, and rate-limit the endpoints that write.

**Quality.** API tests for both the Worker and the Express server with Node's built-in test runner,
and ESLint across the whole project.

```
client/        the React app: sections, phone chapters, intro renderer, game, audio
cloudflare/    the Worker (API), its D1 storage, and the build that assembles the site
server/
  data/        the site's content, as JSON
  src/         routes → controllers → services → models, plus middleware
  test/        API tests
```

---

© 2026 Rudra Narayan Mondal. All rights reserved.
