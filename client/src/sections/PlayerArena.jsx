import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import PixelText from '../components/PixelText';
import { gsap, prefersReduced, scrollToY } from '../lib/motion';
import { useClock, useInView } from '../lib/hooks';
import { useStage } from '../lib/useStage';
import { sfx } from '../lib/audio';

const N_EXPAND = 1; // timeline units spent zooming into the TV

export default function PlayerArena({ content }) {
  const root = useRef(null);
  const stage = useRef(null);
  const screen = useRef(null);
  const stmts = useRef([]);
  const current = useRef(-2);
  const trig = useRef(null);
  const [fsAvailable] = useState(() => typeof document !== 'undefined' && !!document.fullscreenEnabled);
  const [isFs, setIsFs] = useState(false);
  const clock = useClock(content.person.timezone);
  const abilities = content.abilities;
  const n = abilities.length;
  const seen = useInView(root, { threshold: 0.3 });
  const p = content.person;
  useStage(root, '1-3');

  // the TV picture
  useEffect(() => {
    let s = null;
    let dead = false;
    import('../three/crtScene')
      .then(({ createCrtScene }) => {
        if (dead || !screen.current) return;
        try {
          s = createCrtScene(screen.current);
        } catch {
          screen.current?.classList.add('is-fallback');
        }
      })
      .catch(() => screen.current?.classList.add('is-fallback'));
    return () => {
      dead = true;
      s?.dispose();
    };
  }, []);

  const setActive = (idx, local = 0) => {
    const st = stage.current;
    if (!st) return;
    st.style.setProperty('--sp', local.toFixed(3));
    if (idx === current.current) return;
    current.current = idx;
    stmts.current.forEach((el, i) => {
      if (!el) return;
      el.classList.toggle('is-active', i === idx);
      el.classList.toggle('is-past', i < idx);
      el.querySelector('.pixeltext')?.classList.toggle('is-in', i === idx);
    });
    st.dataset.active = idx;
  };

  useGSAP(
    () => {
      const st = stage.current;
      const calc = () => {
        const Wd = st.clientWidth;
        const Ht = st.clientHeight;
        const narrow = Wd < 720;
        let cw = Math.min(Wd * (narrow ? 0.9 : 0.58), 1000);
        let ch = cw * (narrow ? 0.72 : 0.6);
        const maxH = Ht * (narrow ? 0.44 : 0.5);
        if (ch > maxH) {
          ch = maxH;
          cw = ch / (narrow ? 0.72 : 0.6);
        }
        return { ix: Math.max(0, (Wd - cw) / 2), iy: Math.max(0, (Ht - ch) / 2) };
      };

      if (prefersReduced) {
        // no zoom, no scroll-scrubbing: the TV is simply on, and ◀ ▶ step through abilities
        gsap.set(st, { '--ix': '0px', '--iy': '0px', '--b': '3px', '--r': '18px', '--zoom': 1 });
        gsap.set(root.current.querySelectorAll('.arena-head, .arena-big'), { autoAlpha: 0 });
        setActive(0, 1);
        return;
      }

      const total = N_EXPAND + n;
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: () => `+=${window.innerHeight * (total + 0.6)}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const t = self.progress * (total + 0.6);
            if (t < N_EXPAND * 0.92) return setActive(-1, 0);
            const s = Math.min(n - 0.0001, Math.max(0, t - N_EXPAND));
            const idx = Math.floor(s);
            setActive(idx, s - idx);
          },
        },
      });
      tl.fromTo(
        st,
        { '--ix': () => `${calc().ix}px`, '--iy': () => `${calc().iy}px`, '--b': '12px', '--r': '10px', '--zoom': 0.86 },
        { '--ix': '0px', '--iy': '0px', '--b': '3px', '--r': '18px', '--zoom': 1, duration: N_EXPAND, ease: 'power2.inOut' },
        0,
      )
        .to(root.current.querySelector('.arena-head'), { autoAlpha: 0, yPercent: -60, duration: N_EXPAND * 0.5 }, 0)
        .to(root.current.querySelector('.arena-big'), { autoAlpha: 0, yPercent: 60, duration: N_EXPAND * 0.5 }, 0)
        .fromTo(st.querySelectorAll('.tv-osd-expanded'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, N_EXPAND * 0.8)
        .set({}, {}, total + 0.6); // timeline length == scroll length, so progress maps 1:1
      trig.current = { st: tl.scrollTrigger, total: total + 0.6 };
    },
    { scope: root },
  );

  // fullscreen: the abilities autoplay (there is no scroll inside fullscreen)
  useEffect(() => {
    if (!isFs) return;
    let i = 0;
    let t0 = performance.now();
    let raf = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const local = (now - t0) / 2600;
      if (local >= 1) {
        i = (i + 1) % n;
        t0 = now;
      }
      setActive(i, Math.min(1, local));
    };
    current.current = -2;
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isFs, n]);

  useEffect(() => {
    const onFs = () => setIsFs(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // ◀ ▶ — scroll to the neighbouring ability (or step directly when motion is reduced / fullscreen)
  const step = (d) => {
    sfx.select();
    const i = Math.min(n - 1, Math.max(0, (current.current < 0 ? -1 : current.current) + d));
    if (prefersReduced || isFs || !trig.current?.st) return setActive(i, 1);
    const { st, total } = trig.current;
    scrollToY(st.start + ((N_EXPAND + i + 0.5) / total) * (st.end - st.start), { duration: 0.9 });
  };

  const toggleFs = async () => {
    sfx.select();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.current.requestFullscreen();
    } catch {
      /* denied */
    }
  };

  return (
    <section id="player" ref={root} className={`arena ${seen ? 'is-seen' : ''}`} aria-label="Player one — abilities">
      <div className="arena-head">
        <p className="arena-stats" aria-hidden="true">
          <span className="tag-1p">PLAYER 1</span>
          {content.player.stats.map((s) => (
            <span key={s.k}>
              {s.k} <b>{s.v}</b>
            </span>
          ))}
        </p>
        <h2 className="arena-title">
          <span className="arena-iam">I AM</span> <span className="serif-i">{p.shortName}.</span>
        </h2>
      </div>

      <div className="tv-stage" ref={stage} data-active="-1">
        <div className="tv-bezel" aria-hidden="true" />
        <div className="tv-screen">
          <div className="tv-canvas" ref={screen} aria-hidden="true" />
          <div className="tv-glass" aria-hidden="true" />
        </div>

        <div className="tv-osd" aria-hidden="true">
          <span className="osd-tl">CH 03 · {p.initials}-TV</span>
          <span className="osd-tr">
            <i className="rec" /> PLAY
          </span>
          <svg className={`tv-arrow ${seen ? 'is-drawn' : ''}`} viewBox="0 0 64 64" aria-hidden="true">
            <path d="M6 6h6v6h6v6h6v6h6v6h6v6h6v6" />
            <path d="M58 22v36H22" />
          </svg>
        </div>

        <div className="tv-ctrl tv-osd-expanded" role="group" aria-label="Step through abilities">
          <button type="button" onClick={() => step(-1)} aria-label="Previous ability">
            ◀
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next ability">
            ▶
          </button>
        </div>

        <ol className="abilities" aria-label="Abilities">
          {abilities.map((ab, i) => (
            <li key={ab.left} className="ab-stmt" ref={(el) => (stmts.current[i] = el)}>
              <span className="ab-index">
                {String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
              </span>
              <div className="ab-left">
                <PixelText lines={[ab.left]} reveal="power" spread={420} label={ab.left} />
              </div>
              <div className="ab-capsule" aria-hidden="true">
                <span className="cap-fill" />
              </div>
              <div className="ab-right">
                <span className="mask">
                  <span className="mask-inner">{ab.right}</span>
                </span>
                <small className="ab-detail">{ab.detail}</small>
              </div>
            </li>
          ))}
        </ol>

        <dl className="tv-meta tv-osd-expanded">
          <div>
            <dt>SOCIAL</dt>
            <dd>
              <a href={p.links.github} target="_blank" rel="noopener noreferrer">
                GITHUB
              </a>
              {p.links.linkedin ? (
                <>
                  {' / '}
                  <a href={p.links.linkedin} target="_blank" rel="noopener noreferrer">
                    LINKEDIN
                  </a>
                </>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>LOCATION</dt>
            <dd>
              INDIA — <time>{clock}</time> IST
            </dd>
          </div>
          <div>
            <dt>STACK</dt>
            <dd>{content.player.stack}</dd>
          </div>
          <div>
            <dt>CONTACT</dt>
            <dd>{p.email ? <a href={`mailto:${p.email}`}>{p.email.toUpperCase()}</a> : <a href="#continue">INSERT COIN ↓</a>}</dd>
          </div>
        </dl>

        {fsAvailable && (
          <button type="button" className="tv-fs tv-osd-expanded" onClick={toggleFs} aria-pressed={isFs}>
            <span aria-hidden="true">⛶</span> {isFs ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}
          </button>
        )}
      </div>

      <p className="arena-big" aria-hidden="true">
        <span className="arena-iam">I AM</span> <span className="serif-i">{p.shortName}.</span>
      </p>
    </section>
  );
}
