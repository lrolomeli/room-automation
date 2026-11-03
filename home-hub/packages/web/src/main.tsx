import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionProvider } from './context/SessionContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* la PWA sigue funcionando sin service worker */
    });
  });
}
