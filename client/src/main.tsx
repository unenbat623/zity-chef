import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initErrorReporting } from './lib/errorReporting';
import { loadLanguage } from './lib/i18n';
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

// English is a separate chunk now. Awaiting it here means a reader who chose
// English never sees a frame of Mongolian, while a Mongolian reader never
// downloads the English dictionary at all.
const storedLanguage = (() => {
  try {
    return localStorage.getItem('zity_lang') === 'en' ? ('en' as const) : ('mn' as const);
  } catch {
    return 'mn' as const;
  }
})();

// Rendering waits on the dictionary rather than using a top-level await, which
// the browser targets this project builds for do not all support.
void loadLanguage(storedLanguage).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          {/* Motion writes inline styles, so the CSS reduced-motion override in
              index.css cannot reach it — this is what actually stops the page
              transitions and the assistant's infinite pulse for users who asked
              their OS to reduce motion. */}
          {/* LazyMotion + `m` components: the full `motion` bundle shipped every
              animation feature to every visitor. `domAnimation` is the subset
              this app actually uses, and `strict` makes a stray `motion.*`
              (which would quietly pull the whole bundle back in) fail loudly. */}
          <LazyMotion features={domAnimation} strict>
            <MotionConfig reducedMotion="user">
              <App />
            </MotionConfig>
          </LazyMotion>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  );
});
