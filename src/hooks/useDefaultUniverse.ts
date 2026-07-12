/**
 * Client hook that resolves the default story universe for a project.
 * Callers decide whether to prompt the user to run `ensureDefaultUniverse`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ensureDefaultUniverse,
  resolveDefaultUniverse,
} from "@/lib/importation/universe.functions";

export function defaultUniverseKey(projectId: string | null | undefined) {
  return ["default-universe", projectId] as const;
}

export function useDefaultUniverse(projectId: string | null | undefined) {
  const resolve = useServerFn(resolveDefaultUniverse);
  return useQuery({
    queryKey: defaultUniverseKey(projectId),
    queryFn: () => resolve({ data: { projectId: projectId as string } }),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useEnsureDefaultUniverse(projectId: string | null | undefined) {
  const qc = useQueryClient();
  const ensure = useServerFn(ensureDefaultUniverse);
  return useMutation({
    mutationFn: (vars?: { name?: string }) =>
      ensure({
        data: {
          projectId: projectId as string,
          ...(vars?.name ? { name: vars.name } : {}),
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: defaultUniverseKey(projectId) }),
  });
}
