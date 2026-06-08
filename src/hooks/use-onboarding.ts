import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOnboarding } from "@/lib/onboarding.functions";

export function useOnboarding() {
  const fetcher = useServerFn(getOnboarding);
  return useQuery({
    queryKey: ["onboarding"],
    queryFn: () => fetcher(),
    staleTime: 60_000,
  });
}
