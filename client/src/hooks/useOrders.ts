import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OrderRecord, CartItem } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';

async function fetchOrders(): Promise<OrderRecord[]> {
  try {
    const res = await fetch(`${API_BASE}/api/orders`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.orders || [];
  } catch {
    return [];
  }
}

async function createOrderApi(payload: {
  items: CartItem[];
  totalAmount: number;
  deliveryAddress: string;
  paymentMethod: string;
}): Promise<OrderRecord> {
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    initialData: [],
  });

  const createOrderMutation = useMutation({
    mutationFn: createOrderApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  return {
    orders: query.data,
    createOrder: createOrderMutation.mutate,
  };
}
