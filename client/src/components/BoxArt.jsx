import { forwardRef } from 'react';
import Sprite from './Sprite';
import PixelText from './PixelText';

/** A 16-bit cartridge box: console badge, dithered art panel, title strip. */
const BoxArt = forwardRef(function BoxArt({ project, index }, ref) {
  return (
    <div className="boxart" ref={ref} style={{ '--tint': project.bg }}>
      <div className="boxart-inner">
        <div className="ba-top">
          <span className="ba-console">RNM-16</span>
          <span className="ba-status">{project.status}</span>
        </div>
        <div className="ba-art">
          <div className="ba-dither" aria-hidden="true" />
          <div className="ba-grid" aria-hidden="true" />
          {project.image ? (
            <img className="ba-img" src={project.image} alt="" loading="lazy" />
          ) : (
            <div className="ba-sprite">
              <Sprite name={project.sprite} />
            </div>
          )}
          <span className="ba-no" aria-hidden="true">
            NO.{String(index + 1).padStart(3, '0')}
          </span>
        </div>
        <div className="ba-bottom">
          <PixelText lines={[project.name]} decorative className="ba-title" />
          <span className="ba-meta">1 PLAYER · {project.tags[0]}</span>
        </div>
      </div>
    </div>
  );
});

export default BoxArt;
