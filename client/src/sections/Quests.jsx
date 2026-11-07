import { useCallback, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import BoxArt from '../components/BoxArt';
import CaseFile from '../components/CaseFile';
import { gsap, ScrollTrigger, scrollToY } from '../lib/motion';
import { useMagnetic, useMedia } from '../lib/hooks';
import { useStage } from '../lib/useStage';
import { sfx } from '../lib/audio';

const poly = (b, mode) => {
  const m = Math.min(b, 100);
  const k = Math.max(0, b - 100);
  return mode === 'in'
    ? `polygon(0% 0%, ${m}% 0%, ${m}% ${k}%, ${k}% ${m}%, 0% ${m}%)`
    : `polygon(${m}% ${k}%, 100% ${k}%, 100% 100%, ${k}% 100%, ${k}% ${m}%)`;
};

function diagWipe(tl, el, mode, at, duration) {
  if (!el) return;
  const o = { b: 0 };
  el.style.clipPath = poly(0, mode);
  tl.to(
    o,
    {
      b: 200,
      duration,
      ease: 'steps(10)',
      onUpdate: () => (el.style.clipPath = poly(o.b, mode)),
      onComplete: () => {
        if (mode === 'in') el.style.clipPath = 'none';
      },
    },
    at,
  );
}

function Primary({ p, onOpen }) {
  const circle = useRef(null);
  useMagnetic(circle, { strength: 0.4 });
  const inner = (
    <>
      <span className="q-cta-text">{p.liveUrl ? 'VIEW LIVE PROJECT' : 'OPEN CASE FILE'}</span>
      <span className="q-circle" ref={circle} aria-hidden="true">
        <span className="q-arrow">→</span>
      </span>
    </>
  );
  return p.liveUrl ? (
    <a className="q-cta" href={p.liveUrl} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    <button type="button" className="q-cta" onClick={onOpen}>
      {inner}
    </button>
  );
}

function Slide({ p, i, n, setRef, onOpen }) {
  const num = String(i + 1).padStart(2, '0');
  return (
    <article className="q-slide" ref={setRef} aria-roledescription="slide" aria-label={`${num} of ${n}: ${p.name}`}>
      <header className="q-top q-fade">
        <span className="q-num">
          <b>{num}</b> / CASE FILE
        </span>
        <span className="q-cat">{p.category}</span>
      </header>
      <div className="q-grid">
        <div className="q-copy">
          <p className="q-name">
            <span className="mask">
              <span className="mask-inner">
                <b>{p.name}</b> · {p.tags.join(' · ')}
              </span>
            </span>
          </p>
          <h3 className="q-title serif-i">
            <span className="mask">
              <span className="mask-inner">{p.title}</span>
            </span>
          </h3>
          <p className="q-desc serif-i">
            <span className="mask">
              <span className="mask-inner">{p.description}</span>
            </span>
          </p>
          {p.stat && (
            <p className="q-stat q-fade">
              <i aria-hidden="true" /> {p.stat}
            </p>
          )}
          <div className="q-actions q-fade">
            <Primary p={p} onOpen={onOpen} />
            {p.liveUrl && (
              <button type="button" className="q-link" onClick={onOpen}>
                CASE FILE ▸
              </button>
            )}
            {p.sourceUrl && (
              <a className="q-link" href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
                SOURCE CODE ↗
              </a>
            )}
          </div>
        </div>
        <div className="q-art">
          <BoxArt project={p} index={i} />
        </div>
      </div>
      <div className="q-ghost" aria-hidden="true">
        {num}
      </div>
    </article>
  );
}

export default function Quests({ content }) {
  const root = useRef(null);
  const slides = useRef([]);
  const cur = useRef(0);
  const tl = useRef(null);
  const st = useRef(null);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(null);
  const [showIndex, setShowIndex] = useState(false);
  const pinned = useMedia('(min-width: 900px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)');
  const projects = content.projects;
  const n = projects.length;
  const close = useCallback(() => setOpen(null), []);
  useStage(root, '2-2');

  const go = useCallback(
    (next) => {
      const prev = cur.current;
      if (next === prev) return;
      cur.current = next;
      setActive(next);
      const dir = next > prev ? 1 : -1;
      const out = slides.current[prev];
      const inn = slides.current[next];
      tl.current?.progress(1).kill();
      const t = gsap.timeline();
      if (out) {
        t.to(out.querySelectorAll('.mask-inner'), { yPercent: -110 * dir, duration: 0.42, ease: 'power3.in', stagger: 0.03 }, 0)
          .to(out.querySelectorAll('.q-fade, .q-ghost'), { autoAlpha: 0, duration: 0.3 }, 0)
          .set(out, { autoAlpha: 0 }, 0.52);
        diagWipe(t, out.querySelector('.q-art'), 'out', 0, 0.5);
      }
      t.set(inn, { autoAlpha: 1 }, 0.24)
        .fromTo(inn.querySelectorAll('.mask-inner'), { yPercent: 110 * dir }, { yPercent: 0, duration: 1.15, ease: 'elastic.out(1, 0.62)', stagger: 0.07 }, 0.3)
        .fromTo(inn.querySelectorAll('.q-fade'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, stagger: 0.06 }, 0.45)
        .fromTo(inn.querySelector('.q-ghost'), { xPercent: 10 * dir, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 0.05, duration: 1, ease: 'power3.out' }, 0.3)
        .to(root.current, { backgroundColor: projects[next].bg, duration: 0.8, ease: 'power2.out' }, 0);
      diagWipe(t, inn.querySelector('.q-art'), 'in', 0.3, 0.75);
      tl.current = t;
      sfx.blip();
    },
    [projects],
  );

  useGSAP(
    () => {
      if (!pinned) {
        gsap.set(slides.current, { clearProps: 'all' });
        slides.current.forEach((s) => {
          gsap.from(s.querySelectorAll('.q-art, .q-copy > *'), {
            autoAlpha: 0,
            y: 30,
            stagger: 0.08,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: { trigger: s, start: 'top 80%', once: true },
          });
        });
        return;
      }
      cur.current = 0;
      setActive(0);
      slides.current.forEach((s, i) => gsap.set(s, { autoAlpha: i === 0 ? 1 : 0 }));
      gsap.set(root.current, { backgroundColor: projects[0].bg });
      st.current = ScrollTrigger.create({
        trigger: root.current,
        start: 'top top',
        end: () => `+=${window.innerHeight * (n - 0.4)}`,
        pin: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const idx = Math.min(n - 1, Math.floor(self.progress * n));
          go(idx);
        },
        onToggle: (self) => {
          setShowIndex(self.isActive);
          document.documentElement.classList.toggle('quests-active', self.isActive);
        },
      });
      // tilt the box art toward the cursor (±6°) with a little inner parallax
      const onMove = (e) => {
        const art = slides.current[cur.current]?.querySelector('.boxart');
        if (!art) return;
        const r = art.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2);
        const y = (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2);
        gsap.to(art, { rotateY: gsap.utils.clamp(-6, 6, x * 7), rotateX: gsap.utils.clamp(-6, 6, -y * 7), duration: 0.8, ease: 'power3.out' });
        gsap.to(art.querySelector('.ba-sprite, .ba-img'), { x: -x * 12, y: -y * 10, duration: 0.9, ease: 'power3.out' });
      };
      root.current.addEventListener('pointermove', onMove);
      return () => root.current?.removeEventListener('pointermove', onMove);
    },
    { scope: root, dependencies: [pinned], revertOnUpdate: true },
  );

  const jump = (i) => {
    const s = st.current;
    if (!s) return;
    sfx.select();
    scrollToY(s.start + ((i + 0.5) / n) * (s.end - s.start), { duration: 1.1 });
  };

  return (
    <>
      <section id="quests" ref={root} className={`quests ${pinned ? 'is-pinned' : 'is-stacked'}`} aria-label="Selected quests">
        <div className="q-viewport">
          {projects.map((p, i) => (
            <Slide key={p.slug} p={p} i={i} n={n} setRef={(el) => (slides.current[i] = el)} onOpen={() => (sfx.select(), setOpen(p))} />
          ))}
        </div>
      </section>
      {pinned && (
        <nav className={`q-index ${showIndex ? 'is-visible' : ''}`} aria-label="Quest index">
          {projects.map((p, i) => (
            <button key={p.slug} type="button" className={i === active ? 'is-active' : ''} onClick={() => jump(i)} aria-label={`Go to ${p.name}`} aria-current={i === active}>
              <i aria-hidden="true" />
              {String(i + 1).padStart(2, '0')}
            </button>
          ))}
        </nav>
      )}
      <CaseFile project={open} onClose={close} />
    </>
  );
}
