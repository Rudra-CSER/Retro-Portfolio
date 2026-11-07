import { createRoot } from 'react-dom/client';
import '@fontsource/vt323/400.css';
import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/jersey-10/400.css';
import 'lenis/dist/lenis.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/sections.css';
import './styles/game.css';
import './styles/mobile.css';
import App from './App';
import { initPixelHover } from './lib/pixelHover';

// Apply saved palette before first paint to avoid a flash.
try {
  const p = JSON.parse(localStorage.getItem('rudra.palette') || '"arcade"');
  document.documentElement.dataset.palette = p;
  if (JSON.parse(localStorage.getItem('rudra.crt') || 'true') === false) document.documentElement.classList.add('no-crt');
} catch {
  /* ignore */
}

initPixelHover();
createRoot(document.getElementById('root')).render(<App />);
