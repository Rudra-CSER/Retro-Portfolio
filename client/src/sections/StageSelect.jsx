import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, prefersReduced } from '../lib/motion';
import { useStage } from '../lib/useStage';

export default function StageSelect({ content }) {
  const root = useRef(null);
  const s = content.stageSelect;
  useStage(root, '2-1');

  useGSAP(
    () => {
      if (prefersReduced) return;
      gsap.fromTo(
        root.current.querySelectorAll('.ss-line .mask-inner'),
        { yPercent: 110 },
        { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.12, scrollTrigger: { trigger: root.current, start: 'top 62%', once: true } },
      );
      gsap.from(root.current.querySelectorAll('.ss-fade'), {
        autoAlpha: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: 'steps(5)',
        scrollTrigger: { trigger: root.current, start: 'top 62%', once: true },
      });
    },
    { scope: root },
  );

  return (
    <section id="stage-select" ref={root} className="stage-select" aria-labelledby="ss-title">
      <p className="label label-accent ss-fade">
        [ {s.label} ]
      </p>
      <h2 id="ss-title" className="ss-title">
        <span className="ss-line">
          <span className="mask">
            <span className="mask-inner">{s.headline}</span>
          </span>
        </span>
        <span className="ss-line serif-i ss-muted">
          <span className="mask">
            <span className="mask-inner">{s.italic}</span>
          </span>
        </span>
      </h2>
      <div className="ss-cue ss-fade" aria-hidden="true">
        <span>{s.caption}</span>
        <i className="ss-rail">
          <b />
        </i>
      </div>
    </section>
  );
}
