import { useEffect } from 'react';

/**
 * Freezes the app's real scroll container while an overlay is open.
 *
 * The page body never scrolls in this app — the root is `h-[100dvh]
 * overflow-hidden` and all scrolling happens inside `<main>` — so the usual
 * `document.body.style.overflow = 'hidden'` trick is a no-op here. Locking
 * `<main>` is what actually stops a wheel/touch drag on a modal backdrop from
 * scrolling the view behind it. Fixed-position overlays are unaffected: they
 * escape main's overflow even when they are DOM descendants of it.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const main = document.querySelector('main');
    if (!main) return;
    const previous = main.style.overflow;
    main.style.overflow = 'hidden';
    return () => {
      main.style.overflow = previous;
    };
  }, [active]);
}
