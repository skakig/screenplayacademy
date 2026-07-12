/**
 * Type-safe client hook for the scene world context.
 *
 * Wraps `getSceneWorldContext` in a TanStack Query so the editor can render
 * entity cards + relationship edges with proper loading / error / empty
 * states. Types flow through from the server function — do not annotate the
 * returned data.
 */
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSceneWorldContext } from "@/lib/world/worldGraph.functions";
import type { SceneWorldContext } from "@/lib/world/worldGraph";

export interface UseSceneWorldContextArgs {
  projectId: string | null | undefined;
  sceneId: string | null | undefined;
  /** Extra query options (staleTime, refetchOnWindowFocus, etc.). */
  options?: Omit<
    UseQueryOptions<SceneWorldContext, Error>,
    "queryKey" | "queryFn" | "enabled"
  > & { enabled?: boolean };
}

export function sceneWorldContextQueryKey(
  projectId: string | null | undefined,
  sceneId: string | null | undefined,
) {
  return ["scene-world-context", projectId ?? null, sceneId ?? null] as const;
}

export function useSceneWorldContext({
  projectId,
  sceneId,
  options,
}: UseSceneWorldContextArgs) {
  const getCtx = useServerFn(getSceneWorldContext);
  const enabled = Boolean(projectId && sceneId) && (options?.enabled ?? true);

  const query = useQuery<SceneWorldContext, Error>({
    queryKey: sceneWorldContextQueryKey(projectId, sceneId),
    queryFn: () =>
      getCtx({
        data: { projectId: projectId as string, sceneId: sceneId as string },
      }),
    enabled,
    ...options,
  });

  const entities = query.data?.entities ?? [];

  return {
    ...query,
    context: query.data ?? null,
    entities,
    isEmpty: query.isSuccess && entities.length === 0,
  };
}
