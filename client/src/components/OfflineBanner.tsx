import React, { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { WifiOff } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * Tells the user they are offline.
 *
 * The service worker deliberately never caches `/api/`, so losing the network
 * surfaced only as generic per-view error states — or, in the recipe and
 * community tabs, as a bare empty state that read like "there is nothing here"
 * rather than "you are disconnected".
 */
export const OfflineBanner: React.FC = () => {
  const { t } = useApp();
  const [offline, setOffline] = useState<boolean>(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <m.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          role="status"
          aria-live="polite"
          className="fixed top-[calc(0.5rem+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-[390] flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/95 px-4 py-2 text-[11px] font-black text-white shadow-lg max-w-[calc(100%-1.5rem)]"
        >
          <WifiOff size={14} className="shrink-0" />
          <span className="truncate">{t('offline_banner')}</span>
        </m.div>
      )}
    </AnimatePresence>
  );
};
