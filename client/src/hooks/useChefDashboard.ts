import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authedFetch } from '../lib/apiClient';

export interface ChefDashboardOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  address: string;
  odooOrderRef?: string;
  odooSyncError?: string;
  odooSyncedAt?: string;
}

export interface ChefDashboardCustomer {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  subscriptionTier: string;
}

export interface ChefDashboardData {
  message?: string;
  realtime: boolean;
  adminEnabled: boolean;
  stats: {
    customers: number;
    orders: number;
    revenue: number;
    products: number;
    pendingOrders: number;
  };
  recentOrders: ChefDashboardOrder[];
  recentCustomers: ChefDashboardCustomer[];
  odooFailedOrders?: Array<{
    id: string;
    customerName: string;
    customerEmail: string;
    totalAmount: number;
    status: string;
    createdAt: string;
    syncError: string;
    lastAttemptAt: string;
  }>;
}

async function fetchDashboard(): Promise<ChefDashboardData> {
  const res = await authedFetch('/api/chef/dashboard');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load chef dashboard');
  }
  return data;
}

async function updateOrderStatusApi(payload: { orderId: string; status: string }) {
  const res = await authedFetch(`/api/chef/orders/${encodeURIComponent(payload.orderId)}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: payload.status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Failed to update order status');
  return data;
}

async function retryOdooSyncApi(orderId: string) {
  const res = await authedFetch(`/api/odoo/orders/${encodeURIComponent(orderId)}/retry`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Failed to retry Odoo sync');
  return data;
}

export function useChefDashboard() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['chef', 'dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const updateStatusMutation = useMutation({
    mutationFn: updateOrderStatusApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chef', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
  const retryOdooMutation = useMutation({
    mutationFn: retryOdooSyncApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chef', 'dashboard'] });
    },
  });

  return {
    dashboard: query.data,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : '',
    refetch: query.refetch,
    updateOrderStatus: updateStatusMutation.mutate,
    updatingOrderStatus: updateStatusMutation.isPending,
    retryOdooSync: retryOdooMutation.mutate,
    retryingOdooSync: retryOdooMutation.isPending,
  };
}
