/**
 * Central error reporting hook: logs to the console and, when VITE_SENTRY_DSN
 * is set, forwards to Sentry. Keeping it behind this single module means no
 * call site has to know which tracker is in use.
 *
 * Source maps: `build.sourcemap` is on in vite.config.ts, but Sentry can only
 * un-minify a stack trace if the maps are uploaded to it at deploy time
 * (`sentry-cli sourcemaps upload ./dist`) — see DEPLOYMENT.md.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN || '';
const RELEASE = import.meta.env.VITE_SENTRY_RELEASE || undefined;

// Loaded lazily only when a DSN is configured, so the Sentry SDK stays out of
// the bundle for deployments that don't use it.
let sentry: typeof import('@sentry/browser') | null = null;

// Errors thrown before the async import resolves used to be dropped entirely —
// hydration is exactly when they happen. They queue here and flush on init.
const pending: { error: unknown; context?: Record<string, unknown> }[] = [];
const MAX_PENDING = 20;

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.error('[Zity Chef] reportError:', error, context ?? '');
  if (sentry) {
    sentry.captureException(error, { extra: context });
  } else if (DSN && pending.length < MAX_PENDING) {
    pending.push({ error, context });
  }
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
        mod.init({
          dsn: DSN,
          release: RELEASE,
          environment: import.meta.env.MODE,
          // No tracing integration is registered, so a sample rate here would
          // do nothing; errors are what this deployment collects.
          beforeSend(event) {
            // Never ship access tokens to a third party: Supabase puts them in
            // the URL fragment on OAuth and password-recovery returns.
            if (event.request?.url) {
              event.request.url = event.request.url.replace(/#.*$/, '');
            }
            return event;
          },
        });
        // Flush anything captured while the SDK was still loading.
        for (const item of pending.splice(0)) {
          mod.captureException(item.error, { extra: item.context });
        }
      })
      .catch(() => {
        /* Sentry is optional — ignore load failures */
      });
  }
}
