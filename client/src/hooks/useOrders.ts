import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OrderRecord, CartItem } from '../types';
import { authedFetch } from '../lib/apiClient';

async function fetchOrders(): Promise<OrderRecord[]> {
  const res = await authedFetch('/api/orders');
  if (!res.ok) throw new Error('Failed to fetch orders');
  const data = await res.json();
  return data.orders || [];
}

async function createOrderApi(payload: {
  items: CartItem[];
  totalAmount: number;
  deliveryAddress: string;
  paymentMethod: string;
}): Promise<OrderRecord> {
  const res = await authedFetch('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create order');
  const data = await res.json();
  return data.order;
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

  return {
    orders: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    createOrder: createOrderMutation.mutate,
  };
}
