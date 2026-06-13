import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  commentKeys,
  fetchComments,
  fetchProjectScenes,
  type CommentRow,
  type CommentStatus,
} from "@/lib/comments";

export interface CommentThread {
  root: CommentRow;
  replies: CommentRow[];
}

function toThreads(rows: CommentRow[]): CommentThread[] {
  const roots: CommentRow[] = [];
  const repliesByParent = new Map<string, CommentRow[]>();
  for (const row of rows) {
    if (row.parent_comment_id) {
      const list = repliesByParent.get(row.parent_comment_id) ?? [];
      list.push(row);
      repliesByParent.set(row.parent_comment_id, list);
    } else {
      roots.push(row);
    }
  }
  return roots.map((root) => ({
    root,
    replies: (repliesByParent.get(root.id) ?? []).sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    ),
  }));
}

export function useProjectComments(projectId: string, status: CommentStatus) {
  const query = useQuery({
    queryKey: commentKeys.status(projectId, status),
    queryFn: () => fetchComments(projectId, status),
  });
  const threads = useMemo(() => toThreads(query.data ?? []), [query.data]);
  return { ...query, threads };
}

export function useProjectScenes(projectId: string) {
  return useQuery({
    queryKey: commentKeys.scenes(projectId),
    queryFn: () => fetchProjectScenes(projectId),
    staleTime: 30_000,
  });
}
