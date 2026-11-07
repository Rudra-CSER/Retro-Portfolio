import { memo, useMemo } from 'react';

/** 12-spoke asterisk rasterized onto a pixel grid. */
function PixelStar({ size = 23, spokes = 12, className = '', thickness = 0.62 }) {
  const runs = useMemo(() => {
    const c = (size - 1) / 2;
    const R = c;
    const grid = [];
    for (let y = 0; y < size; y++) {
      const row = [];
      for (let x = 0; x < size; x++) {
        const dx = x - c;
        const dy = y - c;
        const r = Math.hypot(dx, dy);
        let on = r <= 1.6;
        if (!on && r <= R) {
          const a = Math.atan2(dy, dx);
          const step = (Math.PI * 2) / spokes;
          const k = Math.round(a / step);
          const da = Math.abs(a - k * step);
          on = Math.sin(da) * r <= thickness + r * 0.035;
        }
        row.push(on);
      }
      grid.push(row);
    }
    const out = [];
    grid.forEach((row, y) => {
      let x = 0;
      while (x < size) {
        if (!row[x]) {
          x++;
          continue;
        }
        let w = 1;
        while (x + w < size && row[x + w]) w++;
        out.push([x, y, w]);
        x += w;
      }
    });
    return out;
  }, [size, spokes, thickness]);

  return (
    <svg className={`pixelstar ${className}`} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-hidden="true">
      {runs.map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height={1} />
      ))}
    </svg>
  );
}

export default memo(PixelStar);
