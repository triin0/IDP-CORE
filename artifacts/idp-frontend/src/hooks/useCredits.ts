import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";

interface CreditBalance {
  balance: number;
  lifetimeSpent: number;
  lifetimeGranted: number;
  costs: {
    generation: number;
    refinement: number;
    verification_only: number;
    starter_grant: number;
  };
}

const API_BASE = import.meta.env.VITE_API_URL ?? `${window.location.origin}/api`;

export function useCredits() {
  const { isAuthenticated } = useAuth();

  const query = useQuery<CreditBalance>({
    queryKey: ["credits", "balance"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/credits/balance`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch credits");
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  return {
    balance: query.data?.balance ?? 0,
    costs: query.data?.costs ?? { generation: 50, refinement: 10, verification_only: 2, starter_grant: 100 },
    lifetimeSpent: query.data?.lifetimeSpent ?? 0,
    lifetimeGranted: query.data?.lifetimeGranted ?? 0,
    isLoading: query.isLoading,
    isAuthenticated,
    refetch: query.refetch,
  };
}
