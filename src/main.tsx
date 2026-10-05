import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './care-workspace.css';
import './birthdays.css';
import './church-care-redesign.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
);
