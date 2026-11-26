import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applySidebar } from './app/sidebarState';
import { applyTheme } from './app/theme';
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource-variable/instrument-sans/wght-italic.css';
import './styles/tokens.css';
import './styles/base.css';

// Static hosts (GitHub Pages) cannot send X-Frame-Options, so refuse to run inside another site's frame
// (clickjacking of Publish / Discard / Delete). The local server also sends X-Frame-Options: DENY.
if (window.top !== window.self) {
  document.documentElement.replaceChildren();
  throw new Error('Project HQ does not run inside a frame.');
}

applyTheme();
applySidebar();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
