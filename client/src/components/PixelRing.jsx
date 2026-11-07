import { memo, useMemo } from 'react';

/** A circle outline rasterized on a coarse grid — the "round" button of a 16-bit pad. */
function PixelRing({ cells = 15, className = '' }) {
  const runs = useMemo(() => {
    const c = (cells - 1) / 2;
    const out = [];
    for (let y = 0; y < cells; y++) {
      let x = 0;
      while (x < cells) {
        const d = Math.hypot(x - c, y - c);
        const on = d <= c + 0.35 && d >= c - 0.75;
        if (!on) {
          x++;
          continue;
        }
        let w = 1;
        while (x + w < cells) {
          const d2 = Math.hypot(x + w - c, y - c);
          if (!(d2 <= c + 0.35 && d2 >= c - 0.75)) break;
          w++;
        }
        out.push([x, y, w]);
        x += w;
      }
    }
    return out;
  }, [cells]);
  return (
    <svg className={`pixelring ${className}`} viewBox={`0 0 ${cells} ${cells}`} shapeRendering="crispEdges" aria-hidden="true">
      {runs.map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height={1} />
      ))}
    </svg>
  );
}

export default memo(PixelRing);
