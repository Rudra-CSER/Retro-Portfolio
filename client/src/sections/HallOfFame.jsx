import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import PixelText from '../components/PixelText';
import { gsap, prefersReduced, ScrollTrigger } from '../lib/motion';
import { useStage } from '../lib/useStage';

const RANK = (i) => `${i + 1}${['ST', 'ND', 'RD'][i] || 'TH'}`;

export default function HallOfFame({ content }) {
  const root = useRef(null);
  const rows = content.hallOfFame;
  useStage(root, '2-3');

  useGSAP(
    () => {
      const title = root.current.querySelector('.hof-title .pixeltext');
      if (prefersReduced) {
        title?.classList.add('is-in');
        root.current.classList.add('is-typed');
        return;
      }
      ScrollTrigger.create({ trigger: root.current, start: 'top 70%', once: true, onEnter: () => title?.classList.add('is-in') });
      const lines = root.current.querySelectorAll('.hof-row');
      gsap.fromTo(
        lines,
        { clipPath: 'inset(0 100% 0 0)' },
        {
          clipPath: 'inset(0 0% 0 0)',
          duration: 0.55,
          ease: 'steps(24)',
          stagger: 0.16,
          scrollTrigger: { trigger: root.current.querySelector('.hof-table'), start: 'top 78%', once: true },
        },
      );
    },
    { scope: root },
  );

  return (
    <section id="fame" ref={root} className="fame section" aria-labelledby="fame-title">
      <div className="fame-head">
        <p className="label">
          <b>[</b> HIGH SCORES <b>]</b>
        </p>
        <h2 id="fame-title" className="hof-title">
          <PixelText lines={['HALL OF FAME']} mobileLines={['HALL OF', 'FAME']} reveal="power" spread={500} label="Hall of fame" />
        </h2>
        <p className="fame-sub serif-i">Experience, education and a few things worth a coin.</p>
      </div>
      <ol className="hof-table">
        <li className="hof-row hof-headrow" aria-hidden="true">
          <span>RANK</span>
          <span>ENTRY</span>
          <span>SCORE</span>
        </li>
        {rows.map((r, i) => (
          <li key={r.title} className={`hof-row rank-${i < 3 ? i + 1 : 'n'}`}>
            <span className="hof-rank">{RANK(i)}</span>
            <span className="hof-entry">
              <strong>{r.title}</strong>
              <small>{r.detail}</small>
            </span>
            <span className="hof-score">{r.score}</span>
          </li>
        ))}
      </ol>
      <p className="hof-foot" aria-hidden="true">
        CREDIT 01 · <span className="blink">INSERT COIN TO CONTINUE</span>
      </p>
    </section>
  );
}
