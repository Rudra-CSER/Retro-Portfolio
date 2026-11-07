import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import PixelText from '../components/PixelText';
import PixelStar from '../components/PixelStar';
import { prefersReduced, ScrollTrigger, scrollToTarget, gsap } from '../lib/motion';
import { registerVisit, sendMessage } from '../lib/api';
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

export default function Continue({ content, resumeAvailable, chapterNo = null }) {
  const root = useRef(null);
  const sendBtn = useRef(null);
  const topBtn = useRef(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState({ state: 'idle', text: '' });
  const [visits, setVisits] = useState(null);
  const { unlock } = useActions();
  const p = content.person;
  const c = content.contact;
  useMagnetic(sendBtn, { strength: 0.3 });
  useMagnetic(topBtn, { strength: 0.4 });
  useStage(root, '4-1');

  useEffect(() => {
    registerVisit().then(setVisits);
  }, []);

  useGSAP(
    () => {
      if (!chapterNo || prefersReduced) return;
      chapterIntro(root.current, { title: null });
      gsap.from(root.current.querySelectorAll('.cont-form > *:not(.hp), .cont-links li'), {
        x: -24,
        autoAlpha: 0,
        stagger: 0.07,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: { trigger: root.current.querySelector('.cont-form'), start: 'top 88%', once: true },
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

  const onSubmit = async (e) => {
    e.preventDefault();
    if (status.state === 'sending') return;
    if (!/^\S+@\S+\.\S{2,}$/.test(email.trim())) {
      setStatus({ state: 'error', text: 'THAT EMAIL LOOKS OFF — TRY AGAIN.' });
      sfx.error();
      return;
    }
    if (message.trim().length < 2) {
      setStatus({ state: 'error', text: 'ADD A LINE ABOUT WHAT YOU HAVE IN MIND.' });
      sfx.error();
      return;
    }
    setStatus({ state: 'sending', text: 'TRANSMITTING…' });
    try {
      await sendMessage({ email: email.trim(), message: message.trim(), company });
      setStatus({ state: 'ok', text: 'MESSAGE SAVED. PLAYER 2 HAS ENTERED THE GAME — EXPECT A REPLY SOON.' });
      setEmail('');
      setMessage('');
      sfx.coin();
      unlock('contact');
    } catch (err) {
      if (err.offline) {
        if (p.email) {
          const body = encodeURIComponent(`${message}\n\n— ${email}`);
          window.location.href = `mailto:${p.email}?subject=${encodeURIComponent('Hello from your portfolio')}&body=${body}`;
          setStatus({ state: 'ok', text: 'OPENING YOUR MAIL APP…' });
        } else {
          setStatus({ state: 'error', text: 'PREVIEW BUILD — THE FORM GOES LIVE WHEN THE SERVER IS RUNNING.' });
        }
      } else {
        setStatus({ state: 'error', text: (err.data?.fields ? Object.values(err.data.fields)[0] : err.message || 'SOMETHING WENT WRONG.').toUpperCase() });
      }
      sfx.error();
    }
  };

  const links = [
    { label: 'GITHUB', href: p.links.github, external: true },
    p.links.linkedin && { label: 'LINKEDIN', href: p.links.linkedin, external: true },
    p.links.x && { label: 'X / TWITTER', href: p.links.x, external: true },
    resumeAvailable && { label: 'RESUME', href: p.links.resume, external: true },
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

          <form className="cont-form" onSubmit={onSubmit} noValidate>
            <label className="sr-only" htmlFor="cf-email">
              Your email
            </label>
            <input
              id="cf-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={c.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className="sr-only" htmlFor="cf-msg">
              Message
            </label>
            <textarea
              id="cf-msg"
              rows={2}
              placeholder={c.messagePlaceholder}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={4000}
              required
            />
            <input
              className="hp"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              name="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <button type="submit" className="send-pill" ref={sendBtn} disabled={status.state === 'sending'}>
              {status.state === 'sending' ? 'SENDING' : 'SEND'}
              <span className="send-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
            <p className={`cont-status is-${status.state}`} role="status" aria-live="polite">
              {status.text}
            </p>
          </form>
        </div>

        <div className="cont-right">
          <PixelStar className="cont-star" />
          {p.email ? (
            <p className="cont-email">
              <span className="label">
                <b>(</b> EMAIL <b>)</b>
              </span>
              <a href={`mailto:${p.email}`}>{p.email.toUpperCase()}</a>
            </p>
          ) : (
            <p className="cont-email">
              <span className="label">
                <b>(</b> STATUS <b>)</b>
              </span>
              <span className="cont-avail">
                <i className="dot" /> {p.availability}
              </span>
            </p>
          )}
          <ul className="cont-links">
            {links.map((l) => (
              <li key={l.label}>
                <MagLink href={l.href} external={l.external}>
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
          {content.expertise.map((x) => (
            <span key={x}>{x}</span>
          ))}
        </p>
      </div>

      <div className="cont-bar">
        <p>
          © 2026 {p.name.toUpperCase()} · <span className="domain">{p.domain ? p.domain.toUpperCase() : 'RUDRA.ROM'}</span>
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
