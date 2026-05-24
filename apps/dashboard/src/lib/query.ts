import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: (count, err: unknown) => {
        const code = (err as { status?: number } | null)?.status;
        if (code === 401 || code === 404) return false;
        return count < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});
