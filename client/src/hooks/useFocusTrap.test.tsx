import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { useFocusTrap } from './useFocusTrap';

/**
 * The dialogs close on Escape and announce themselves as dialogs, but focus
 * used to stay on the page behind them: a keyboard user tabbed straight out of
 * an open payment sheet with nothing to tell them where they were.
 */
function Dialog({ open }: { open: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>(open);
  return (
    <div>
      <button type="button">outside</button>
      {open && (
        <div ref={ref} tabIndex={-1} role="dialog">
          <button type="button">first</button>
          <button type="button">last</button>
        </div>
      )}
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus into the dialog when it opens', () => {
    render(<Dialog open />);
    expect(document.activeElement).toBe(screen.getByText('first'));
  });

  it('wraps Tab from the last control back to the first', () => {
    render(<Dialog open />);
    const last = screen.getByText('last');
    last.focus();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });

    expect(document.activeElement).toBe(screen.getByText('first'));
  });

  it('wraps Shift+Tab from the first control to the last', () => {
    render(<Dialog open />);
    screen.getByText('first').focus();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(screen.getByText('last'));
  });

  it('gives focus back to whatever opened it', () => {
    const { rerender } = render(<Dialog open={false} />);
    const opener = screen.getByText('outside');
    opener.focus();

    rerender(<Dialog open />);
    expect(document.activeElement).toBe(screen.getByText('first'));

    rerender(<Dialog open={false} />);
    expect(document.activeElement).toBe(opener);
  });
});
