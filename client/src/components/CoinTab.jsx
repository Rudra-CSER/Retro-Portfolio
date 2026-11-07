import { scrollToTarget } from '../lib/motion';
import { sfx } from '../lib/audio';
import Sprite from './Sprite';

export default function CoinTab({ initial = 'R', text = 'AVAILABLE FOR WORK' }) {
  return (
    <a
      href="#continue"
      className="coin-tab"
      onClick={(e) => {
        e.preventDefault();
        sfx.coin();
        scrollToTarget('#continue');
      }}
      aria-label={`${text} — insert coin to get in touch`}
    >
      <span className="coin-spin" aria-hidden="true">
        <Sprite name="coin" />
      </span>
      <span className="coin-r" aria-hidden="true">
        {initial}.
      </span>
      <span className="coin-text" aria-hidden="true">
        {text} <em>· INSERT COIN</em>
      </span>
    </a>
  );
}
