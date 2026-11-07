import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import PixelText from '../components/PixelText';
import PixelStar from '../components/PixelStar';
import { prefersReduced, ScrollTrigger, scrollToTarget, gsap } from '../lib/motion';
import { registerVisit } from '../lib/api';
import { copyText, selectText } from '../lib/clipboard';
import { useMagnetic } from '../lib/hooks';
import { useStage } from '../lib/useStage';
import { useActions } from '../lib/state';
import { sfx } from '../lib/audio';
import { chapterIntro } from '../mobile/fx';

const NAV = [
  ['Home', '#top'],
  ['Bio', '#bio'],
  ['Abilities', '#player'],
  ['Quests', '#quests'],
  ['Bonus stage', '#arcade'],
  ['Contact', '#continue'],
];

function MagLink({ href, children, external, onClick, className = '' }) {
  const ref = useRef(null);
  useMagnetic(ref, { strength: 0.22, radius: 40 });
  return (
    <a
      ref={ref}
      href={href}
      className={className}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

const pad2 = (n) => String(n).padStart(2, '0');

export default function Continue({ content, chapterNo = null }) {
  const root = useRef(null);
  const mailBtn = useRef(null);
  const topBtn = useRef(null);
  const address = useRef(null);
  const [status, setStatus] = useState({ state: 'idle', text: '' });
  const [visits, setVisits] = useState(null);
  const { unlock } = useActions();
  const p = content.person;
  const c = content.contact;
  const mailto = `mailto:${p.email}?subject=${encodeURIComponent(c.subject)}`;
  useMagnetic(mailBtn, { strength: 0.3 });
  useMagnetic(topBtn, { strength: 0.4 });
  useStage(root, '4-1');

  useEffect(() => {
    let current = true;
    registerVisit().then((n) => current && setVisits(n));
    return () => {
      current = false;
    };
  }, []);

  useGSAP(
    () => {
      if (!chapterNo || prefersReduced) return;
      chapterIntro(root.current, { title: null });
      gsap.from(root.current.querySelectorAll('.cont-actions > *, .cont-links li'), {
        x: -24,
        autoAlpha: 0,
        stagger: 0.07,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: { trigger: root.current.querySelector('.cont-actions'), start: 'top 88%', once: true },
      });
    },
    { scope: root },
  );

  useGSAP(
    () => {
      const logo = root.current.querySelector('.cont-logo .pixeltext');
      if (prefersReduced) {
        logo?.classList.add('is-in');
        return;
      }
      ScrollTrigger.create({ trigger: logo, start: 'top 92%', once: true, onEnter: () => logo.classList.add('is-in') });
      gsap.fromTo(
        root.current.querySelectorAll('.cont-line .mask-inner'),
        { yPercent: 110 },
        { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.1, scrollTrigger: { trigger: root.current, start: 'top 70%', once: true } },
      );
    },
    { scope: root },
  );

  // The link itself opens the visitor's mail app; this only adds the coin sound and a hint.
  const onEmail = () => {
    sfx.coin();
    unlock('contact');
    setStatus({ state: 'ok', text: 'OPENING YOUR MAIL APP… NOTHING HAPPENED? COPY THE ADDRESS INSTEAD.' });
  };

  const onCopy = async () => {
    if (await copyText(p.email)) {
      sfx.coin();
      unlock('contact');
      setStatus({ state: 'ok', text: `COPIED ${p.email.toUpperCase()}. PLAYER 2, YOUR MOVE.` });
    } else {
      selectText(address.current);
      sfx.error();
      setStatus({ state: 'error', text: 'YOUR BROWSER BLOCKED COPYING. THE ADDRESS IS SELECTED: PRESS CTRL+C (⌘C).' });
    }
  };

  const links = [
    p.links.github && { label: 'GITHUB', href: p.links.github },
    p.links.linkedin && { label: 'LINKEDIN', href: p.links.linkedin },
    p.links.x && { label: 'X / TWITTER', href: p.links.x },
    p.links.resume && { label: 'RESUME', href: p.links.resume },
  ].filter(Boolean);

  const go = (target) => (e) => {
    e.preventDefault();
    scrollToTarget(target);
  };

  return (
    <footer id="continue" ref={root} className="cont">
      <div className="cont-top">
        <div className="cont-left">
          {chapterNo ? (
            <p className="mch-no" aria-hidden="true">
              <b>
                {pad2(chapterNo.index)} / {pad2(chapterNo.total)}
              </b>
            </p>
          ) : null}
          <p className="label">
            <b>(</b> {c.label} <b>)</b>
          </p>
          <h2 className="cont-title">
            <span className="cont-line">
              <span className="mask">
                <span className="mask-inner">{c.headline}</span>
              </span>
            </span>
            <span className="cont-line serif-i">
              <span className="mask">
                <span className="mask-inner">{c.italic}</span>
              </span>
            </span>
          </h2>

          <div className="cont-actions">
            <a ref={mailBtn} className="send-pill" href={mailto} onClick={onEmail}>
              {c.cta}
              <span className="send-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
            <button type="button" className="cont-copy" onClick={onCopy}>
              COPY ADDRESS
            </button>
          </div>
          <p className={`cont-status is-${status.state}`} role="status" aria-live="polite">
            {status.text}
          </p>
        </div>

        <div className="cont-right">
          <PixelStar className="cont-star" />
          <p className="cont-email">
            <span className="label">
              <b>(</b> EMAIL <b>)</b>
            </span>
            <a ref={address} href={mailto} onClick={onEmail}>
              {p.email}
            </a>
          </p>
          <p className="cont-avail">
            <i className="dot" aria-hidden="true" /> {p.availability}
          </p>
          <ul className="cont-links">
            {links.map((l) => (
              <li key={l.label}>
                <MagLink href={l.href} external>
                  {l.label} <span aria-hidden="true">↗</span>
                </MagLink>
              </li>
            ))}
            <li>
              <MagLink href="#arcade" onClick={go('#arcade')}>
                PLAY PIXEL CUP <span aria-hidden="true">↺</span>
              </MagLink>
            </li>
          </ul>
        </div>
      </div>

      <div className="cont-logo">
        <PixelText lines={[p.logotype]} reveal="rise" label={p.name} />
      </div>

      <div className="cont-rows">
        <p>
          <span className="row-label">NAVIGATE</span>
          {NAV.map(([label, href]) => (
            <a key={href} href={href} onClick={go(href)}>
              {label}
            </a>
          ))}
        </p>
        <p>
          <span className="row-label">EXPERTISE</span>
          {content.expertise.map((x, i) => (
            <span key={`${i}-${x}`}>{x}</span>
          ))}
        </p>
      </div>

      <div className="cont-bar">
        <p>
          © {new Date().getFullYear()} {p.name.toUpperCase()} · <span className="domain">{p.domain ? p.domain.toUpperCase() : 'RUDRA.ROM'}</span>
        </p>
        <p className="visits" aria-label={visits ? `Visitor number ${visits}` : undefined}>
          {visits ? (
            <>
              YOU ARE VISITOR
              <span className="odo">
                {String(visits)
                  .padStart(6, '0')
                  .split('')
                  .map((d, i) => (
                    <b key={i}>{d}</b>
                  ))}
              </span>
            </>
          ) : (
            'BEST VIEWED ON A CRT AT 3 A.M.'
          )}
        </p>
        <button
          type="button"
          className="to-top"
          onClick={() => {
            sfx.select();
            scrollToTarget('#top');
          }}
        >
          RESPAWN
          <span className="to-top-circle" ref={topBtn} aria-hidden="true">
            ↑
          </span>
        </button>
      </div>
    </footer>
  );
}
