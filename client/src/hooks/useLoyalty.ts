import { useQuery } from '@tanstack/react-query';
import { authedFetch } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';

/**
 * Zity Points — 1% of every delivered basket, one award per order.
 *
 * Read-only: the award itself happens on the server when an order is marked
 * delivered, so a cancelled order cannot earn points and the browser cannot
 * ask for them.
 */
async function fetchBalance(): Promise<number> {
  const res = await authedFetch('/api/loyalty/points');
  if (!res.ok) throw new Error('Failed to load points');
  const data = await res.json();
  return Number(data.balance ?? 0);
}

export interface PointsEntry {
  id: string;
  orderRef: string;
  amount: number;
  points: number;
  earnedAt: string;
}

const NO_ENTRIES: PointsEntry[] = [];

async function fetchHistory(): Promise<PointsEntry[]> {
  const res = await authedFetch('/api/loyalty/history');
  if (!res.ok) throw new Error('Failed to load points history');
  const data = await res.json();
  return data.entries || [];
}

export function useLoyalty() {
  // Points belong to an account. Asking for them as a signed-out visitor —
  // which the store and profile screens both did on every visit — earned two
  // 401s per page load, in the console and in error reporting.
  const { user, isAnonymous } = useAuth();
  const signedIn = Boolean(user) && !isAnonymous;

  const query = useQuery({
    queryKey: ['loyalty', 'points'],
    queryFn: fetchBalance,
    enabled: signedIn,
    staleTime: 60_000,
    retry: false,
  });

  const historyQuery = useQuery({
    queryKey: ['loyalty', 'history'],
    queryFn: fetchHistory,
    enabled: signedIn,
    staleTime: 60_000,
    retry: false,
  });

  return {
    balance: query.data ?? 0,
    history: historyQuery.data ?? NO_ENTRIES,
    loading: query.isLoading,
    isError: query.isError,
  };
}
