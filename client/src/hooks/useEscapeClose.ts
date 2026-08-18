import { useEffect } from 'react';

/**
 * Closes an overlay on Escape.
 *
 * Every dialog in the app used to trap the user until they found its own close
 * button — on a laptop that is the first key anyone reaches for, and on a phone
 * an external keyboard behaves the same way.
 *
 * Pass `active: false` for a modal that stays mounted while hidden, so a closed
 * dialog does not keep listening.
 */
export function useEscapeClose(onClose: () => void, active: boolean = true): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, active]);
}
