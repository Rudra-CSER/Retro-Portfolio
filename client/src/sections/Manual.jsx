import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import PixelText from '../components/PixelText';
import PixelStar from '../components/PixelStar';
import Marquee from '../components/Marquee';
import Definition from '../components/Definition';
import { gsap, prefersReduced, scrollToTarget, ScrollTrigger } from '../lib/motion';
import { useStage } from '../lib/useStage';

function Bracket({ side }) {
  // a chunky pixel "[" (mirrored for "]")
  const rows = 40;
  const rects = [];
  for (let y = 0; y < rows; y++) {
    const edge = y < 3 || y > rows - 4;
    const round = y === 0 || y === rows - 1;
    rects.push(<rect key={`v${y}`} x={round ? 1 : 0} y={y} width={round ? 3 : 4} height={1} />);
    if (edge) rects.push(<rect key={`h${y}`} x={4} y={y} width={round ? 7 : 8} height={1} />);
  }
  return (
    <svg className={`bracket bracket-${side}`} viewBox={`0 0 12 ${rows}`} preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
      {rects}
    </svg>
  );
}

export default function Manual({ content }) {
  const root = useRef(null);
  const m = content.manual;
  useStage(root, '1-4');

  useGSAP(
    () => {
      const word = root.current.querySelector('.man-word .pixeltext');
      if (prefersReduced) {
        word?.classList.add('is-in');
        return;
      }
      ScrollTrigger.create({ trigger: word, start: 'top 82%', once: true, onEnter: () => word.classList.add('is-in') });
      const words = root.current.querySelectorAll('.def-word');
      gsap.fromTo(
        words,
        { yPercent: 55, opacity: 0.15, filter: 'blur(7px)' },
        {
          yPercent: 0,
          opacity: 1,
          filter: 'blur(0px)',
          ease: 'power2.out',
          stagger: 0.12,
          scrollTrigger: {
            trigger: root.current.querySelector('.def-text'),
            start: 'top 82%',
            end: 'bottom 42%',
            scrub: 0.8,
          },
        },
      );
      gsap.from(root.current.querySelectorAll('.bracket'), {
        xPercent: (i) => (i ? 60 : -60),
        opacity: 0,
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: { trigger: root.current, start: 'top 75%', once: true },
      });
      gsap.from(root.current.querySelectorAll('.man-fade'), {
        autoAlpha: 0,
        y: 18,
        stagger: 0.1,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: root.current, start: 'top 70%', once: true },
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="manual" className="manual section" aria-labelledby="manual-word">
      <Bracket side="l" />
      <Bracket side="r" />
      <div className="manual-inner">
        <p className="label man-fade">
          <b>[</b> {m.label} <b>]</b>
        </p>
        <h2 id="manual-word" className="man-word">
          <PixelText lines={[m.word]} label={m.word} maxPx={30} reveal="power" spread={500} />
          <PixelStar className="man-star" />
        </h2>
        <p className="man-pron man-fade">
          <span className="serif-i">{m.pronunciation}</span>
          <span className="pill">{m.pos}</span>
        </p>
        <Definition text={m.definition} />
        <p className="def-2 man-fade">{m.definition2}</p>
        <p className="caps-label man-fade">{m.synonyms}</p>
        <p className="man-credit man-fade">
          {m.creditLead}{' '}
          <a
            href="#bio"
            onClick={(e) => {
              e.preventDefault();
              scrollToTarget('#bio');
            }}
          >
            {m.creditLink}
          </a>
        </p>
      </div>

      <div className="inventory">
        <p className="label">
          <b>[</b> INVENTORY · TOOLS I WORK WITH <b>]</b>
        </p>
        <Marquee speed={46} label="Tools">
          {content.tools.map((t) => (
            <span key={t} className="inv-item">
              <i className="inv-slot" aria-hidden="true" />
              {t}
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
