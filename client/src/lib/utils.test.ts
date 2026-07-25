import { describe, it, expect } from 'vitest';

function formatCurrency(amount: number): string {
  return `₮${amount.toLocaleString('mn-MN')}`;
}

function calculateExpiryDays(dateStr: string): number {
  const expiry = new Date(dateStr);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

describe('Enterprise Utility Tests', () => {
  it('should correctly format currency in MNT (₮)', () => {
    expect(formatCurrency(14900)).toBe('₮14,900');
    expect(formatCurrency(0)).toBe('₮0');
  });

  it('should correctly calculate expiry days remaining', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const days = calculateExpiryDays(futureDate.toISOString());
    expect(days).toBeGreaterThanOrEqual(4);
    expect(days).toBeLessThanOrEqual(5);
  });
});
