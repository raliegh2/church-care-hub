import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Application root was not found.');
}

// index.html contains useful, crawlable fallback content. Remove it immediately
// before mounting React so the browser source is meaningful without causing a
// hydration mismatch or duplicate-heading warning.
container.replaceChildren();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
