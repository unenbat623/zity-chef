import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initErrorReporting } from './lib/errorReporting';
import App from './App.tsx';
import './index.css';

initErrorReporting();

// Service-worker registration lives here rather than as an inline <script> in
// index.html — that inline block was the only reason script-src needed
// 'unsafe-inline', which neutralised most of the CSP's XSS protection.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('[SW] Registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* Motion writes inline styles, so the CSS reduced-motion override in
            index.css cannot reach it — this is what actually stops the page
            transitions and the assistant's infinite pulse for users who asked
            their OS to reduce motion. */}
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
