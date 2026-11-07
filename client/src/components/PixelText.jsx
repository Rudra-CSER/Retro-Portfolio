import { forwardRef, useMemo } from 'react';
import { layoutLines } from '../lib/pixelfont';
import { mulberry32, useMedia } from '../lib/hooks';

/**
 * Renders text in the TALLPIX bitmap face as crisp SVG rects.
 *  reveal="power" → pixels flicker on in a left-to-right sweep (add class "is-in")
 *  reveal="rise"  → letters rise from below one by one (add class "is-in")
 *  maxPx          → caps the pixel width so short words don't balloon
 */
const PixelText = forwardRef(function PixelText(
  { lines, mobileLines, label, className = '', aspect = 1.55, gap = 0.09, maxPx, reveal, spread = 700, seed = 7, style, decorative = false },
  ref,
) {
  const narrow = useMedia('(max-width: 720px)');
  const use = narrow && mobileLines ? mobileLines : lines;
  const key = use.join('\n');

  const { rects, w, vbH, groups } = useMemo(() => {
    const { pixels, w, h, chars } = layoutLines(use);
    const rand = mulberry32(seed);
    const rects = pixels.map(([x, y, , ci]) => ({
      x: x + gap / 2,
      y: y * aspect + gap / 2,
      ci,
      d: Math.round((x / w) * spread + rand() * 220),
    }));
    let groups = null;
    if (reveal === 'rise') {
      groups = chars.map((c, i) => ({ i, rects: rects.filter((r) => r.ci === i) }));
    }
    return { rects, w, vbH: h * aspect, groups };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, aspect, gap, spread, seed, reveal]);

  const rw = 1 - gap;
  const rh = aspect - gap;
  const cls = ['pixeltext', reveal ? `pt-reveal pt-${reveal}` : '', className].filter(Boolean).join(' ');

  return (
    <span
      ref={ref}
      className={cls}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label ?? use.join(' ')}
      style={style}
    >
      <svg
        viewBox={`0 0 ${w} ${vbH}`}
        style={{ aspectRatio: `${w} / ${vbH}`, maxWidth: maxPx ? `${w * maxPx}px` : undefined }}
        aria-hidden="true"
        focusable="false"
        shapeRendering="crispEdges"
      >
        {groups
          ? groups.map((g) => (
              <g key={g.i} className="pt-ch" style={{ '--ci': g.i }}>
                {g.rects.map((r, k) => (
                  <rect key={k} x={r.x} y={r.y} width={rw} height={rh} />
                ))}
              </g>
            ))
          : rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={rw} height={rh} style={reveal ? { '--d': `${r.d}ms` } : undefined} />)}
      </svg>
    </span>
  );
});

export default PixelText;
