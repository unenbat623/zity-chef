import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Keeps keyboard focus inside an open dialog, and gives it back afterwards.
 *
 * The modals already close on Escape and carry `role="dialog"`, but focus stayed
 * wherever it was: a keyboard or screen-reader user opened a payment sheet and
 * kept tabbing through the page behind it, with no way to tell what they were
 * on. This moves focus to the dialog on open, cycles Tab within it, and returns
 * focus to whatever opened it on close.
 *
 * Attach the returned ref to the dialog element and give it `tabIndex={-1}` so
 * it can hold focus when it contains no focusable child.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!active || !container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        // Deliberately not a layout check (`offsetParent`, `getClientRects`):
        // a fixed-position dialog reports no offset parent in some browsers,
        // which would empty this list and trap focus on the container itself.
        // Everything a dialog actually hides is marked one of these two ways.
        (element) =>
          !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true'
      );

    (focusable()[0] ?? container).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && index === items.length - 1) {
        event.preventDefault();
        items[0].focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      // Returning focus matters as much as trapping it: without it the next Tab
      // starts from the top of the document.
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [active]);

  return ref;
}
