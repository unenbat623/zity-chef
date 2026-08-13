import { useQuery } from '@tanstack/react-query';
import { authedFetch } from '../lib/apiClient';

export interface ChefDashboardOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  address: string;
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
}

async function fetchDashboard(): Promise<ChefDashboardData> {
  const res = await authedFetch('/api/chef/dashboard');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load chef dashboard');
  }
  return data;
}

export function useChefDashboard() {
  const query = useQuery({
    queryKey: ['chef', 'dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  return {
    dashboard: query.data,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : '',
    refetch: query.refetch,
  };
}
