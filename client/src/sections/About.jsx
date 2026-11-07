import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, prefersReduced, SplitText } from '../lib/motion';
import { useStage } from '../lib/useStage';

export default function About({ content }) {
  const root = useRef(null);
  const a = content.about;
  useStage(root, '1-2');

  useGSAP(
    () => {
      if (prefersReduced) return;
      const para = root.current.querySelector('.about-para');
      SplitText.create(para, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        linesClass: 'about-line',
        onSplit(self) {
          return gsap.from(self.lines, {
            yPercent: 105,
            duration: 1.1,
            ease: 'power4.out',
            stagger: 0.085,
            scrollTrigger: { trigger: para, start: 'top 78%', once: true },
          });
        },
      });
      gsap.from(root.current.querySelectorAll('.about-fade'), {
        autoAlpha: 0,
        y: 24,
        duration: 1,
        stagger: 0.12,
        ease: 'power3.out',
        scrollTrigger: { trigger: root.current.querySelector('.about-foot'), start: 'top 88%', once: true },
      });
      gsap.from(root.current.querySelector('.about-speaker'), {
        autoAlpha: 0,
        x: -12,
        duration: 0.6,
        ease: 'steps(4)',
        scrollTrigger: { trigger: para, start: 'top 82%', once: true },
      });
    },
    { scope: root },
  );

  return (
    <section id="bio" ref={root} className="about section" aria-labelledby="bio-label">
      <div className="about-col">
        <p id="bio-label" className="label">
          <b>(</b> {a.label} <b>)</b>
        </p>
        <p className="about-speaker" aria-hidden="true">
          <span className="speaker-tag">RUDRA</span>
          <span className="speaker-line" />
        </p>
        <p className="about-para">
          {a.paragraph} <em className="accent-i">{a.accent}</em>
          <span className="about-advance" aria-hidden="true">
            ▼
          </span>
        </p>
        <div className="about-foot">
          <p className="caps-label about-fade">{a.caption}</p>
          <p className="about-tagline serif-i about-fade">{a.tagline}</p>
        </div>
      </div>
    </section>
  );
}
