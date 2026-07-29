/**
 * Central error reporting hook. Today it logs to the console; it is the single
 * place to forward errors to Sentry / an error tracker.
 *
 * To enable Sentry later:
 *   1. npm i @sentry/react
 *   2. set VITE_SENTRY_DSN
 *   3. in initErrorReporting(): dynamically import @sentry/react and Sentry.init,
 *      then call Sentry.captureException(error) inside reportError().
 * Keeping it behind this single module means no call sites change.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN || '';

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.error('[Zity Chef] reportError:', error, context ?? '');
  // if (sentryLoaded) Sentry.captureException(error, { extra: context });
}

/**
 * Installs global handlers so uncaught errors and unhandled promise rejections
 * anywhere in the app are captured (not just React render errors).
 */
export function initErrorReporting(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (e) => {
    reportError(e.error ?? e.message, { kind: 'window.error' });
  });
  window.addEventListener('unhandledrejection', (e) => {
    reportError(e.reason, { kind: 'unhandledrejection' });
  });

  if (DSN && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[Zity Chef] VITE_SENTRY_DSN set — wire @sentry/react in initErrorReporting().');
  }
}
