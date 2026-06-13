import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  boardKeys,
  fetchActiveLocks,
  fetchActiveProjectMembers,
  fetchBoardScenes,
  fetchSceneAssignments,
  type SceneAssignmentRow,
  type SceneLockRow,
} from "@/lib/assignments";

export interface BoardScene {
  id: string;
  title: string | null;
  scene_heading: string | null;
  order_index: number;
  status: string | null;
}

export interface SceneRowData {
  scene: BoardScene;
  ordinal: number; // 1-based, for "Scene N" fallback
  assignments: SceneAssignmentRow[];
  activeLock: SceneLockRow | null;
}

export function useProductionBoard(projectId: string) {
  const scenesQ = useQuery({
    queryKey: boardKeys.scenes(projectId),
    queryFn: () => fetchBoardScenes(projectId),
  });
  const assignmentsQ = useQuery({
    queryKey: boardKeys.assignments(projectId),
    queryFn: () => fetchSceneAssignments(projectId),
  });
  const locksQ = useQuery({
    queryKey: boardKeys.locks(projectId),
    queryFn: () => fetchActiveLocks(projectId),
  });

  const rows: SceneRowData[] = useMemo(() => {
    const scenes = (scenesQ.data ?? []) as BoardScene[];
    const assignments = assignmentsQ.data ?? [];
    const locks = locksQ.data ?? [];
    const byScene = new Map<string, SceneAssignmentRow[]>();
    for (const a of assignments) {
      const list = byScene.get(a.scene_id) ?? [];
      list.push(a);
      byScene.set(a.scene_id, list);
    }
    const lockByScene = new Map<string, SceneLockRow>();
    for (const l of locks) lockByScene.set(l.scene_id, l);

    return scenes.map((scene, i) => ({
      scene,
      ordinal: i + 1,
      assignments: byScene.get(scene.id) ?? [],
      activeLock: lockByScene.get(scene.id) ?? null,
    }));
  }, [scenesQ.data, assignmentsQ.data, locksQ.data]);

  return {
    rows,
    isLoading:
      scenesQ.isLoading || assignmentsQ.isLoading || locksQ.isLoading,
    isError: scenesQ.isError || assignmentsQ.isError || locksQ.isError,
  };
}

export function useActiveProjectMembers(projectId: string) {
  return useQuery({
    queryKey: boardKeys.activeMembers(projectId),
    queryFn: () => fetchActiveProjectMembers(projectId),
    staleTime: 30_000,
  });
}
