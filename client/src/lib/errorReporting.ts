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

// Loaded lazily only when a DSN is configured, so the Sentry SDK stays out of
// the bundle for deployments that don't use it.
let sentry: typeof import('@sentry/browser') | null = null;

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.error('[Zity Chef] reportError:', error, context ?? '');
  if (sentry) sentry.captureException(error, { extra: context });
}

/**
 * Installs global handlers so uncaught errors and unhandled promise rejections
 * anywhere in the app are captured (not just React render errors). When
 * VITE_SENTRY_DSN is set, also initializes the Sentry SDK.
 */
export function initErrorReporting(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (e) => {
    reportError(e.error ?? e.message, { kind: 'window.error' });
  });
  window.addEventListener('unhandledrejection', (e) => {
    reportError(e.reason, { kind: 'unhandledrejection' });
  });

  if (DSN) {
    import('@sentry/browser')
      .then((mod) => {
        sentry = mod;
        mod.init({ dsn: DSN, tracesSampleRate: 0.1, environment: import.meta.env.MODE });
      })
      .catch(() => {
        /* Sentry is optional — ignore load failures */
      });
  }
}
