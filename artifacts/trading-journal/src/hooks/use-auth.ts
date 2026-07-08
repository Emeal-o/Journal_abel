import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, logout as apiLogout } from "@/lib/auth-api";

export const AUTH_QUERY_KEY = ["auth-me"] as const;

export function useAuth() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getMe,
    retry: false,
    staleTime: 5 * 60 * 1000,   // treat the session as fresh for 5 minutes
    refetchOnWindowFocus: true,  // re-check when the tab regains focus
  });

  async function logout() {
    await apiLogout();
    // Wipe all cached data so the next user starts clean
    queryClient.clear();
  }

  return {
    userId: query.data?.userId ?? null,
    isAuthenticated: query.data != null,
    isLoading: query.isLoading,
    logout,
  };
}
