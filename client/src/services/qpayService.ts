import { authedFetch } from '../lib/apiClient';

export interface QpayInvoice {
  simulated: boolean;
  invoiceId: string;
  /** Server-computed charge (subscriptions are priced server-side). */
  amount?: number;
  qrImage: string | null;
  qrText: string;
  urls: { name?: string; description?: string; logo?: string; link: string }[];
}

export type QpayCreateError = 'SIGN_IN_REQUIRED' | 'UNAVAILABLE';

export interface QpayCreateResult {
  invoice: QpayInvoice | null;
  /** Set when invoice is null, so the UI can say *why* instead of spinning. */
  error: QpayCreateError | null;
}

export async function createQpayInvoice(
  amount: number,
  description: string,
  orderRef?: string,
  /** 'pro' | 'family' when this invoice buys a subscription. The server records
   *  the intent, prices it itself, and upgrades the account once paid. */
  plan?: 'pro' | 'family'
): Promise<QpayCreateResult> {
  try {
    const res = await authedFetch('/api/payments/qpay/create', {
      method: 'POST',
      body: JSON.stringify({ amount, description, orderRef, plan }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const error: QpayCreateError =
        body?.error === 'SIGN_IN_REQUIRED' ? 'SIGN_IN_REQUIRED' : 'UNAVAILABLE';
      return { invoice: null, error };
    }
    return { invoice: (await res.json()) as QpayInvoice, error: null };
  } catch {
    return { invoice: null, error: 'UNAVAILABLE' };
  }
}

export async function checkQpayPayment(invoiceId: string): Promise<boolean> {
  try {
    const res = await authedFetch('/api/payments/qpay/check', {
      method: 'POST',
      body: JSON.stringify({ invoiceId }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.paid);
  } catch {
    return false;
  }
}
