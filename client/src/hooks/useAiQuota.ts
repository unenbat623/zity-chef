import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authedFetch } from '../lib/apiClient';

export interface AiQuota {
  used: number;
  remaining: number;
  limit: number;
  tier: 'free' | 'pro' | 'family';
  allowed: boolean;
}

const FALLBACK: AiQuota = { used: 0, remaining: 0, limit: 0, tier: 'free', allowed: true };

async function fetchQuota(): Promise<AiQuota> {
  const res = await authedFetch('/api/ai/quota');
  if (!res.ok) throw new Error('quota unavailable');
  return (await res.json()) as AiQuota;
}

/**
 * Today's AI allowance, straight from the server. The tier lives in Postgres,
 * not localStorage, so this is the number the backend will actually enforce.
 */
export function useAiQuota() {
  const queryClient = useQueryClient();
  const query = useQuery<AiQuota>({
    queryKey: ['ai', 'quota'],
    queryFn: fetchQuota,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    quota: query.data ?? FALLBACK,
    isLoading: query.isLoading,
    /** Call after a request is spent so the counter reflects it immediately. */
    refresh: () => queryClient.invalidateQueries({ queryKey: ['ai', 'quota'] }),
  };
}
