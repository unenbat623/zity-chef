import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authedFetch } from '../lib/apiClient';

/**
 * The operator's side of the Odoo bridge.
 *
 * Health, reconciliation, the product pull and the sync log all existed as
 * endpoints but had no screen behind them: the only way to see whether Chef and
 * Odoo still agreed — or to make them agree again — was a terminal and a curl
 * command. Everything here is chef-admin only and refuses politely otherwise.
 */
export interface OdooStatus {
  configured: boolean;
  connected: boolean;
  alert?: boolean;
  failedSyncs?: number;
  lastError?: string;
}

export interface OdooLogEntry {
  id: string;
  timestamp: string;
  action: string;
  status: 'success' | 'warning' | 'error';
  message: string;
}

export interface OdooReconcileSummary {
  checkedOrders: number;
  missingInOdoo: number;
  missingInDelguur: number;
  amountMismatches: number;
  statusMismatches: number;
  message: string;
}

const NO_LOGS: OdooLogEntry[] = [];

async function fetchStatus(): Promise<OdooStatus> {
  const res = await authedFetch('/api/odoo/status');
  if (!res.ok) throw new Error('Failed to load Odoo status');
  return res.json();
}

async function fetchLogs(): Promise<OdooLogEntry[]> {
  const res = await authedFetch('/api/odoo/logs');
  if (!res.ok) throw new Error('Failed to load Odoo logs');
  const data = await res.json();
  return data.logs || [];
}

export function useOdooOps(enabled: boolean) {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['odoo', 'status'],
    queryFn: fetchStatus,
    enabled,
    refetchInterval: 30_000,
    retry: false,
  });

  const logsQuery = useQuery({
    queryKey: ['odoo', 'logs'],
    queryFn: fetchLogs,
    enabled,
    refetchInterval: 30_000,
    retry: false,
  });

  const reconcileMutation = useMutation({
    mutationFn: async (): Promise<OdooReconcileSummary> => {
      const res = await authedFetch('/api/odoo/reconcile', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Reconciliation failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['odoo'] });
      queryClient.invalidateQueries({ queryKey: ['chef', 'dashboard'] });
    },
  });

  const syncProductsMutation = useMutation({
    mutationFn: async (): Promise<number> => {
      const res = await authedFetch('/api/odoo/products/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Product sync failed');
      return Number(data.updates ?? 0);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['odoo'] });
      queryClient.invalidateQueries({ queryKey: ['store', 'products'] });
    },
  });

  return {
    status: statusQuery.data,
    statusLoading: statusQuery.isLoading,
    logs: logsQuery.data ?? NO_LOGS,
    logsError: logsQuery.isError,
    reconcile: reconcileMutation.mutateAsync,
    reconciling: reconcileMutation.isPending,
    lastReconcile: reconcileMutation.data,
    syncProducts: syncProductsMutation.mutateAsync,
    syncingProducts: syncProductsMutation.isPending,
  };
}
