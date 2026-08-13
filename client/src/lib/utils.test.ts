import { describe, it, expect } from 'vitest';
import { formatQuantity } from './utils';

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

  it('should format ingredient quantities in metric and imperial systems', () => {
    expect(formatQuantity(1500, 'гр')).toBe('1.5 кг');
    expect(formatQuantity(500, 'гр', 'imperial')).toBe('1.1 lb');
    expect(formatQuantity(1, 'л', 'imperial')).toBe('33.8 fl oz');
    expect(formatQuantity(3, 'ш', 'imperial')).toBe('3 pcs');
  });
});
