import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import MChapter from './MChapter';
import BoxArt from '../components/BoxArt';
import CaseFile from '../components/CaseFile';
import Marquee from '../components/Marquee';
import { gsap, prefersReduced } from '../lib/motion';
import { sfx } from '../lib/audio';

const pad2 = (n) => String(n).padStart(2, '0');

/** Projects as a swipeable cover-flow deck of cartridges. */
export default function MQuests({ content, chapter, index, total }) {
  const projects = content.projects;
  const n = projects.length;
  const deck = useRef(null);
  const cards = useRef([]);
  const countEl = useRef(null);
  const bar = useRef(null);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(null);
  const close = useCallback(() => setOpen(null), []);
  const more = content.more.flat().filter((m) => !projects.some((p) => p.name.startsWith(m.label)));

  // cover-flow: cards rotate and shrink with their distance from the snap point
  useEffect(() => {
    const d = deck.current;
    let raf = 0;
    const run = () => {
      raf = 0;
      const first = cards.current[0];
      if (!first) return;
      const anchor = d.scrollLeft + first.offsetLeft + first.offsetWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      cards.current.forEach((c, i) => {
        if (!c) return;
        const off = (c.offsetLeft + c.offsetWidth / 2 - anchor) / c.offsetWidth;
        const a = Math.min(1, Math.abs(off));
        const inner = c.firstElementChild;
        if (!prefersReduced) inner.style.transform = `perspective(900px) rotateY(${(-off * 18).toFixed(2)}deg) scale(${(1 - a * 0.09).toFixed(3)})`;
        inner.style.opacity = (1 - a * 0.38).toFixed(3);
        if (Math.abs(off) < bestDist) {
          bestDist = Math.abs(off);
          best = i;
        }
      });
      setActive(best);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    d.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    run();
    return () => {
      cancelAnimationFrame(raf);
      d.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, [n]);

  // counter + progress + a little hop from the new cartridge's sprite
  const firstRun = useRef(true);
  useLayoutEffect(() => {
    if (prefersReduced) {
      gsap.set(bar.current, { scaleX: (active + 1) / n });
      return;
    }
    gsap.to(bar.current, { scaleX: (active + 1) / n, duration: 0.7, ease: 'expo.out' });
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    sfx.blip();
    gsap.fromTo(countEl.current, { yPercent: 70, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'back.out(2.2)' });
    const sprite = cards.current[active]?.querySelector('.ba-sprite');
    if (sprite) gsap.fromTo(sprite, { y: -16, scale: 0.9 }, { y: 0, scale: 1, duration: 0.9, ease: 'bounce.out' });
  }, [active, n]);

  const step = (d) => {
    const i = Math.max(0, Math.min(n - 1, active + d));
    const c = cards.current[i];
    if (!c) return;
    sfx.select();
    deck.current.scrollTo({ left: c.offsetLeft - cards.current[0].offsetLeft, behavior: prefersReduced ? 'auto' : 'smooth' });
  };

  const p = projects[active];
  return (
    <MChapter id={chapter.id} index={index} total={total} title={chapter.title} kicker={chapter.kicker} stage="2-2" className="mch-quests">
      <div className="mq-meta" data-reveal>
        <span className="mq-count">
          <b ref={countEl}>{pad2(active + 1)}</b> / {pad2(n)}
        </span>
        <span className="mq-cat">{p.category.split('·')[0].trim()}</span>
      </div>

      <div className="mq-deck" ref={deck} data-reveal role="group" aria-roledescription="carousel" aria-label="Projects">
        {projects.map((q, i) => (
          <article key={q.slug} className="mq-card" ref={(el) => (cards.current[i] = el)} aria-label={`${i + 1} of ${n}: ${q.name}`}>
            <div className="mq-inner">
              <BoxArt project={q} index={i} />
              <div className="mq-body">
                <p className="mq-name">
                  <b>{q.name}</b> · {q.tags.slice(0, 3).join(' · ')}
                </p>
                <h3 className="mq-title serif-i">{q.title}</h3>
                <p className="mq-desc">{q.description}</p>
                {q.stat ? <p className="mq-stat">{q.stat}</p> : null}
                <div className="mq-actions">
                  <button
                    type="button"
                    className="mq-btn"
                    onClick={() => {
                      sfx.select();
                      setOpen(q);
                    }}
                  >
                    CASE FILE ▸
                  </button>
                  {q.liveUrl ? (
                    <a className="mq-btn ghost" href={q.liveUrl} target="_blank" rel="noopener noreferrer">
                      LIVE ↗
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mq-nav" data-reveal>
        <button type="button" onClick={() => step(-1)} disabled={active === 0} aria-label="Previous project">
          ◀
        </button>
        <i className="mq-bar" aria-hidden="true">
          <b ref={bar} />
        </i>
        <button type="button" onClick={() => step(1)} disabled={active === n - 1} aria-label="Next project">
          ▶
        </button>
      </div>

      <div className="mq-more" data-reveal>
        <p className="label">
          <b>(</b> AND MORE <b>)</b>
        </p>
        <Marquee speed={44} velocity label="More projects">
          {more.map((m, i) => (
            <span key={`${i}-${m.label}`} className="mq-more-item">
              {m.label}
              <i aria-hidden="true" />
            </span>
          ))}
        </Marquee>
        <a className="mq-github" href={content.person.links.github} target="_blank" rel="noopener noreferrer">
          MORE ON GITHUB ↗
        </a>
      </div>

      <CaseFile project={open} onClose={close} />
    </MChapter>
  );
}
