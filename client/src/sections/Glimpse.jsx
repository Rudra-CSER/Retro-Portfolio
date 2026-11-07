import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import Marquee from '../components/Marquee';
import PixelStar from '../components/PixelStar';
import Sprite from '../components/Sprite';
import { finePointer, gsap, prefersReduced, scrollToTarget } from '../lib/motion';
import { useStage } from '../lib/useStage';

export default function Glimpse({ content }) {
  const root = useRef(null);
  const card = useRef(null);
  const [hover, setHover] = useState(null);
  const rows = content.more;
  const offset = content.projects.length;
  useStage(root, '3-2');

  // numbering continues after the featured quests: 07, 08, …
  let k = 0;
  const numbered = rows.map((row) => row.map((it) => ({ ...it, no: String(offset + ++k).padStart(2, '0') })));

  useGSAP(
    () => {
      if (prefersReduced) return;
      gsap.fromTo(
        root.current.querySelector('.glimpse-star'),
        { rotate: 0, scale: 0.8 },
        { rotate: 140, scale: 1.25, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: true } },
      );
      gsap.from(root.current.querySelectorAll('.gl-fade'), {
        autoAlpha: 0,
        y: 20,
        stagger: 0.1,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: root.current, start: 'top 72%', once: true },
      });
    },
    { scope: root },
  );

  // cursor-following polaroid
  useEffect(() => {
    if (!finePointer || prefersReduced) return;
    const el = card.current;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.55, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.55, ease: 'power3.out' });
    const rTo = gsap.quickTo(el, 'rotation', { duration: 0.8, ease: 'power3.out' });
    let lx = 0;
    const move = (e) => {
      xTo(e.clientX + 24);
      yTo(e.clientY - 120);
      rTo(gsap.utils.clamp(-14, 14, (e.clientX - lx) * 0.9) - 4);
      lx = e.clientX;
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  return (
    <section id="more" ref={root} className="glimpse" aria-labelledby="glimpse-title">
      <PixelStar className="glimpse-star" size={41} />
      <div className="glimpse-head">
        <p className="label gl-fade">
          <b>(</b> MORE <b>)</b>
        </p>
        <h2 id="glimpse-title" className="glimpse-title gl-fade">
          And that’s <span className="serif-i muted">only level one.</span>
        </h2>
      </div>

      <div className="glimpse-rows" onPointerLeave={() => setHover(null)}>
        {numbered.map((row, r) => (
          <Marquee key={r} speed={60 + r * 8} reverse={r % 2 === 1} velocity className="glimpse-row" label={r === 0 ? 'More projects' : undefined}>
            {row.map((it, i) => (
              <span
                key={`${i}-${it.label}`}
                className="gl-item"
                onPointerEnter={() => setHover(it)}
                onPointerLeave={() => setHover((h) => (h === it ? null : h))}
                onClick={() => it.sprite === 'ball' && scrollToTarget('#arcade')}
                data-cursor={it.sprite === 'ball' ? '' : undefined}
              >
                {it.label}
                <i className="gl-sep" aria-hidden="true" />
              </span>
            ))}
          </Marquee>
        ))}
      </div>

      <div className="glimpse-foot gl-fade">
        <a href={content.person.links.github} target="_blank" rel="noopener noreferrer" className="gl-github">
          <span className="muted">(AND MORE ON)</span> <u>GITHUB ↗</u>
        </a>
        <a
          href="#quests"
          className="gl-all"
          onClick={(e) => {
            e.preventDefault();
            scrollToTarget('#quests');
          }}
        >
          SEE ALL QUESTS →
        </a>
      </div>

      <div ref={card} className={`polaroid ${hover ? 'is-on' : ''}`} aria-hidden="true">
        {hover && (
          <>
            <div className="pol-img">
              <Sprite name={hover.sprite} />
            </div>
            <p className="pol-cap">
              <b>{hover.no}</b> {hover.label}
            </p>
            <p className="pol-sub">{hover.caption}</p>
          </>
        )}
      </div>
    </section>
  );
}
