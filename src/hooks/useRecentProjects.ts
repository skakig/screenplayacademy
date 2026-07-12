/**
 * Track and read the user's most recently opened projects. Convenience only —
 * writes to localStorage, then validated against the authenticated user's
 * `projects` query (RLS-scoped) so we never surface stale, deleted, or
 * unauthorized entries.
 */
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const KEY = "scenesmith.recent-projects.v1";
const MAX = 5;

type StoredEntry = { id: string; ts: number };

function readStored(): StoredEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is StoredEntry => e && typeof e.id === "string" && typeof e.ts === "number")
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function writeStored(entries: StoredEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    // storage full or blocked — recents are non-essential
  }
}

/** Record `projectId` as most-recent. Safe to call repeatedly. */
export function recordRecentProject(projectId: string | null | undefined) {
  if (!projectId) return;
  const now = Date.now();
  const existing = readStored().filter((e) => e.id !== projectId);
  writeStored([{ id: projectId, ts: now }, ...existing]);
}

/** Convenience effect: call inside a component to record on mount / on change. */
export function useRecordRecentProject(projectId: string | null | undefined) {
  useEffect(() => {
    recordRecentProject(projectId);
  }, [projectId]);
}

export type RecentProject = {
  id: string;
  title: string;
  updated_at: string | null;
};

/**
 * Return the user's up-to-`limit` most-recently opened projects, validated
 * against their RLS-scoped `projects` list. Stale local IDs are dropped from
 * storage as a side effect so the list self-heals.
 */
export function useRecentProjects(limit = 3): {
  recents: RecentProject[];
  isLoading: boolean;
} {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", "recents-source"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,title,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RecentProject[];
    },
    staleTime: 30_000,
  });

  const stored = useMemo(() => readStored(), [projects]);

  const recents = useMemo<RecentProject[]>(() => {
    if (!projects || projects.length === 0) return [];
    const byId = new Map(projects.map((p) => [p.id, p]));
    const validated: RecentProject[] = [];
    const kept: StoredEntry[] = [];
    for (const entry of stored) {
      const project = byId.get(entry.id);
      if (project) {
        validated.push(project);
        kept.push(entry);
      }
      if (validated.length >= limit) break;
    }
    // Prune stale entries so we don't keep re-checking them.
    if (kept.length !== stored.length) writeStored(kept);
    return validated;
  }, [projects, stored, limit]);

  return { recents, isLoading };
}
