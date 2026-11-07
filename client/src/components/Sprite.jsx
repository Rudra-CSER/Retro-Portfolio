import { memo, useMemo } from 'react';
import { getSprite, SPRITE_COLORS } from '../lib/sprites';

/** 16×16 pixel sprite rendered as merged horizontal runs (few rects, crisp edges). */
function Sprite({ name, className = '', title }) {
  const runs = useMemo(() => {
    const rows = getSprite(name);
    const out = [];
    rows.forEach((row, y) => {
      let x = 0;
      while (x < 16) {
        const c = row[x];
        if (c === '.') {
          x++;
          continue;
        }
        let w = 1;
        while (x + w < 16 && row[x + w] === c) w++;
        out.push({ x, y, w, c });
        x += w;
      }
    });
    return out;
  }, [name]);

  return (
    <svg
      className={`sprite ${className}`}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {runs.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} style={{ fill: SPRITE_COLORS[r.c] || 'currentColor' }} />
      ))}
    </svg>
  );
}

export default memo(Sprite);
