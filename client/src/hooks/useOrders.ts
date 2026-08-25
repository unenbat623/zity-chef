import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OrderRecord, CartItem } from '../types';
import { authedFetch } from '../lib/apiClient';

const NO_ORDERS: OrderRecord[] = [];

async function fetchOrders(): Promise<OrderRecord[]> {
  const res = await authedFetch('/api/orders');
  if (!res.ok) throw new Error('Failed to fetch orders');
  const data = await res.json();
  return data.orders || [];
}

/**
 * Why an order could not be created, in a form the checkout screen can explain.
 * The reason used to be thrown away with a generic message — and the caller
 * ignored it entirely, so a paid customer was left with an empty cart and no
 * order.
 */
export class OrderError extends Error {
  constructor(
    /** Server error code: OUT_OF_STOCK, PAYMENT_REQUIRED, INVALID_ITEMS, … */
    readonly code: string,
    /** The product that ran out, when the code is OUT_OF_STOCK. */
    readonly product?: string,
    /** How many of it are left. */
    readonly available?: number
  ) {
    super(code);
    this.name = 'OrderError';
  }
}

async function createOrderApi(payload: {
  items: CartItem[];
  totalAmount: number;
  deliveryAddress: string;
  paymentMethod: string;
  /** The paid QPay invoice this order settles against (server-verified). */
  invoiceId?: string;
  /** Zity points to spend on this order; the server caps them at the balance. */
  redeemPoints?: number;
}): Promise<OrderRecord> {
  const res = await authedFetch('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new OrderError(String(data.error || 'ORDER_FAILED'), data.product, data.available);
  }
  return data.order;
}

async function cancelOrderApi(orderId: string): Promise<void> {
  const res = await authedFetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new OrderError(String(data.message || data.error || 'CANCEL_FAILED'));
}

export function useOrders() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const createOrderMutation = useMutation({
    mutationFn: createOrderApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: cancelOrderApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  return {
    orders: query.data ?? NO_ORDERS,
    isLoading: query.isLoading,
    isError: query.isError,
    /** Resolves with the created order, or rejects with an OrderError. */
    createOrder: createOrderMutation.mutateAsync,
    cancelOrder: cancelOrderMutation.mutateAsync,
    cancellingOrder: cancelOrderMutation.isPending,
  };
}
