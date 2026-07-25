import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes fresh data cache
      gcTime: 1000 * 60 * 30, // 30 minutes in memory
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
