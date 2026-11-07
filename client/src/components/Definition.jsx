import { useMemo } from 'react';

/** "*emphasis*" → <em>; everything is split into word spans for the scroll wave. */
export default function Definition({ text }) {
  const parts = useMemo(() => {
    const out = [];
    text.split(/(\*[^*]+\*)/g).forEach((chunk) => {
      if (!chunk) return;
      const em = chunk.startsWith('*') && chunk.endsWith('*');
      const words = (em ? chunk.slice(1, -1) : chunk).split(/(\s+)/);
      words.forEach((w) => out.push({ w, em }));
    });
    return out;
  }, [text]);
  return (
    <p className="def-text">
      {parts.map((p, i) =>
        /^\s+$/.test(p.w) ? (
          ' '
        ) : p.w ? (
          <span key={i} className={`def-word ${p.em ? 'is-em' : ''}`}>
            {p.w}
          </span>
        ) : null,
      )}
    </p>
  );
}
