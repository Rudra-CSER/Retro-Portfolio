import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import MChapter from './MChapter';
import Definition from '../components/Definition';
import PixelText from '../components/PixelText';
import PixelStar from '../components/PixelStar';
import { gsap, prefersReduced, SplitText } from '../lib/motion';
import { pixelAssemble } from './fx';

export default function MBio({ content, chapter, index, total }) {
  const body = useRef(null);
  const a = content.about;
  const m = content.manual;

  useGSAP(
    () => {
      if (prefersReduced) return;
      const el = body.current;
      const para = el.querySelector('.mb-para');
      SplitText.create(para, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: 110,
            duration: 0.9,
            ease: 'power4.out',
            stagger: 0.07,
            scrollTrigger: { trigger: para, start: 'top 86%', once: true },
          }),
      });
      // player-card tiles flip down like cartridge labels
      gsap.from(el.querySelectorAll('.mb-stat'), {
        rotationX: -95,
        transformOrigin: '50% 0%',
        transformPerspective: 700,
        autoAlpha: 0,
        duration: 0.85,
        ease: 'back.out(1.7)',
        stagger: 0.09,
        scrollTrigger: { trigger: el.querySelector('.mb-stats'), start: 'top 90%', once: true },
      });
      // dictionary entry: the word assembles, then the definition rises word by word with scroll
      pixelAssemble(el.querySelector('.mb-word svg'), {
        spread: 12,
        scrollTrigger: { trigger: el.querySelector('.mb-dict'), start: 'top 85%', once: true },
      });
      gsap.fromTo(
        el.querySelectorAll('.def-word'),
        { yPercent: 55, opacity: 0.15, filter: 'blur(6px)' },
        {
          yPercent: 0,
          opacity: 1,
          filter: 'blur(0px)',
          ease: 'power2.out',
          stagger: 0.1,
          scrollTrigger: { trigger: el.querySelector('.def-text'), start: 'top 90%', end: 'bottom 60%', scrub: 0.6 },
        },
      );
    },
    { scope: body },
  );

  return (
    <MChapter id={chapter.id} index={index} total={total} title={chapter.title} kicker={chapter.kicker} stage="1-2" className="mch-bio">
      <div className="mb" ref={body}>
        <p className="mb-speaker" data-reveal aria-hidden="true">
          <span className="speaker-tag">RUDRA</span>
          <span className="speaker-line" />
        </p>
        <p className="mb-para">
          {a.short} <em className="accent-i">{a.accent}</em>
        </p>
        <dl className="mb-stats">
          {content.player.stats.map((s) => (
            <div key={s.k} className="mb-stat">
              <dt>{s.k}</dt>
              <dd>{s.v}</dd>
            </div>
          ))}
        </dl>
        <div className="mb-dict">
          <p className="mb-word">
            <PixelText lines={[m.word]} label={m.word} maxPx={4.4} />
            <PixelStar className="mb-star" />
          </p>
          <p className="mb-pron">
            <span className="serif-i">{m.pronunciation}</span>
            <span className="pill">{m.pos}</span>
          </p>
          <Definition text={m.definition} />
          <p className="caps-label mb-syn">{m.synonyms}</p>
        </div>
      </div>
    </MChapter>
  );
}
