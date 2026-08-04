import { Currency } from '../types';

// Approximate rates relative to MNT (1 USD ≈ 3450 MNT, 1 EUR ≈ 3750 MNT, 1 JPY ≈ 23 MNT, 1 KRW ≈ 2.5 MNT)
const EXCHANGE_RATES: Record<Currency, number> = {
  MNT: 1,
  USD: 1 / 3450,
  EUR: 1 / 3750,
  JPY: 1 / 23,
  KRW: 1 / 2.5,
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  MNT: '₮',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  KRW: '₩',
};

/**
 * Format a base price in MNT into the targeted global currency with appropriate symbol and decimals.
 */
export function formatCurrency(amountInMNT: number, currency: Currency = 'MNT'): string {
  const rate = EXCHANGE_RATES[currency] || 1;
  const symbol = CURRENCY_SYMBOLS[currency] || '₮';
  const converted = amountInMNT * rate;

  if (currency === 'MNT' || currency === 'JPY' || currency === 'KRW') {
    return `${symbol}${Math.round(converted).toLocaleString()}`;
  }

  return `${symbol}${converted.toFixed(2)}`;
}
