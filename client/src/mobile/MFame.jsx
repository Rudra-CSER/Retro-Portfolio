import { useLayoutEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import MChapter from './MChapter';
import { gsap, prefersReduced } from '../lib/motion';
import { sfx } from '../lib/audio';

const TOP = 5;
const RANK = (i) => `${i + 1}${['ST', 'ND', 'RD'][i] || 'TH'}`;

export default function MFame({ content, chapter, index, total }) {
  const rows = content.hallOfFame;
  const [all, setAll] = useState(false);
  const list = useRef(null);

  // rows "type" onto the high-score table
  useGSAP(
    () => {
      if (prefersReduced) return;
      gsap.fromTo(
        list.current.querySelectorAll('.mf-row:not(.is-extra)'),
        { clipPath: 'inset(0 100% 0 0)' },
        {
          clipPath: 'inset(0 0% 0 0)',
          duration: 0.5,
          ease: 'steps(16)',
          stagger: 0.13,
          scrollTrigger: { trigger: list.current, start: 'top 86%', once: true },
        },
      );
    },
    { scope: list },
  );

  useLayoutEffect(() => {
    if (!all || prefersReduced) return;
    gsap.fromTo(
      list.current.querySelectorAll('.mf-row.is-extra'),
      { clipPath: 'inset(0 100% 0 0)', autoAlpha: 0 },
      { clipPath: 'inset(0 0% 0 0)', autoAlpha: 1, duration: 0.45, ease: 'steps(14)', stagger: 0.1 },
    );
  }, [all]);

  return (
    <MChapter id={chapter.id} index={index} total={total} title={chapter.title} kicker={chapter.kicker} stage="2-3" className="mch-fame">
      <ol className="mf-list" ref={list}>
        {rows.map((r, i) => (
          <li key={r.title} className={`mf-row ${i < 3 ? `rank-${i + 1}` : ''} ${i >= TOP ? 'is-extra' : ''}`} hidden={i >= TOP && !all}>
            <span className="mf-rank">{RANK(i)}</span>
            <span className="mf-entry">
              <strong>{r.title}</strong>
              <small>{r.detail}</small>
            </span>
            <span className="mf-score">{r.score}</span>
          </li>
        ))}
      </ol>
      {rows.length > TOP ? (
        <button
          type="button"
          className="mf-more"
          aria-expanded={all}
          onClick={() => {
            sfx.select();
            setAll((v) => !v);
          }}
        >
          {all ? 'SHOW TOP 5 ▲' : `SHOW ALL ${rows.length} ▼`}
        </button>
      ) : null}
    </MChapter>
  );
}
