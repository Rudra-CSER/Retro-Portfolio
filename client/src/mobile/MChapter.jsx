import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import PixelText from '../components/PixelText';
import { useStage } from '../lib/useStage';
import { chapterIntro } from './fx';

const pad2 = (n) => String(n).padStart(2, '0');

/** One phone "chapter": numbered header with a pixel title, then its content. */
export default function MChapter({ id, index, total, title, kicker, stage, className = '', children }) {
  const root = useRef(null);
  useStage(root, stage);
  useGSAP(() => {
    chapterIntro(root.current);
  }, { scope: root });

  return (
    <section id={id} ref={root} className={`mch ${className}`} aria-labelledby={`${id}-title`}>
      <header className="mch-head">
        <p className="mch-no" aria-hidden="true">
          <b>
            {pad2(index)} / {pad2(total)}
          </b>
        </p>
        <h2 id={`${id}-title`} className="mch-title">
          <PixelText lines={[title]} label={title} maxPx={4.4} />
        </h2>
        <i className="mch-rule" aria-hidden="true" />
        {kicker ? (
          <p className="mch-kicker serif-i">
            <span className="mask">
              <span className="mask-inner">{kicker}</span>
            </span>
          </p>
        ) : null}
      </header>
      <div className="mch-body">{children}</div>
    </section>
  );
}
