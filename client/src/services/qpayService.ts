import { authedFetch } from '../lib/apiClient';

export interface QpayInvoice {
  simulated: boolean;
  invoiceId: string;
  qrImage: string | null;
  qrText: string;
  urls: { name?: string; description?: string; logo?: string; link: string }[];
}

export async function createQpayInvoice(
  amount: number,
  description: string,
  orderRef?: string,
  /** 'pro' | 'family' when this invoice buys a subscription. The server records
   *  the intent and upgrades the account itself once the payment clears. */
  plan?: 'pro' | 'family'
): Promise<QpayInvoice | null> {
  try {
    const res = await authedFetch('/api/payments/qpay/create', {
      method: 'POST',
      body: JSON.stringify({ amount, description, orderRef, plan }),
    });
    if (!res.ok) return null;
    return (await res.json()) as QpayInvoice;
  } catch {
    return null;
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
