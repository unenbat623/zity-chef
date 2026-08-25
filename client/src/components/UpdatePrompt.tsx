import React, { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * Offers a reload when a new build is waiting.
 *
 * The service worker calls `skipWaiting()`, so a new version takes over the
 * next time the app is opened — but a tab that stays open (this is a PWA people
 * leave running) kept the old JS indefinitely, with no hint that a newer one
 * existed. This watches the registration and asks, rather than reloading under
 * the user's hands mid-checkout.
 */
export const UpdatePrompt: React.FC = () => {
  const { t } = useApp();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;

    navigator.serviceWorker.ready
      .then((registration) => {
        if (cancelled) return;
        if (registration.waiting) setWaiting(registration.waiting);

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // "installed" with an existing controller means a newer build is
            // ready and this tab is still running the old one.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaiting(installing);
            }
          });
        });
      })
      .catch(() => {
        /* no service worker — nothing to offer */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!waiting) return null;

  return (
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        role="status"
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:max-w-sm z-[200] flex items-center gap-3 rounded-2xl border border-pestle-border bg-pestle-card/95 backdrop-blur-xl px-4 py-3 shadow-2xl"
      >
        <RefreshCw size={16} className="shrink-0 text-mango-ink" />
        <p className="min-w-0 flex-1 text-[11px] font-bold text-pestle-text">
          {t('update_available')}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-xl bg-mango px-3 py-2 text-[11px] font-black text-white"
        >
          {t('update_reload')}
        </button>
      </m.div>
    </AnimatePresence>
  );
};
