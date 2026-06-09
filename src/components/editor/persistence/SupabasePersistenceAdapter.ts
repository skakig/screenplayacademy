// SupabasePersistenceAdapter — Pass 2 (+ Code-Red data-safety pass).
//
// Background sync target for the screenplay editor. Implements the
// PersistenceAdapter interface so the editor hook never has to know about
// Supabase.
//
// Code-Red additions:
//   • tracks failed localIds so the UI can show a banner and offer "Retry"
//   • sticky "error" save status — does NOT flip to "saved" while any
//     row remains unsaved
//   • optional `onSaveError` callback (used for telemetry / writing_events)
//   • mid-retry attempts no longer mis-report "error" before the retry runs

import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  PersistRow,
  PersistSnapshot,
  PersistenceAdapter,
} from "../screenplayPersistence";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type SaveErrorInfo = {
  kind: "insert" | "update" | "delete";
  localId?: string;
  serverId?: string;
  message: string;
  attempts: number;
};

const DEFAULT_UPDATE_DEBOUNCE_MS = 600;
const DEFER_WHEN_INSERTING_MS = 400;
const RETRY_DELAYS_MS = [300, 900, 2700];

type InsertJob = {
  row: PersistRow;
  onServerId: (serverId: string) => void;
  attempt: number;
};

type UpdateJob = {
  getSnapshot: () => PersistSnapshot | undefined;
  timer: ReturnType<typeof setTimeout> | null;
  attempt: number;
};

export function createSupabasePersistenceAdapter({
  projectId,
  queryClient,
  onSaveStatus,
  onLastSaved,
  onSaveError,
}: {
  projectId: string;
  queryClient: QueryClient;
  onSaveStatus?: (s: SaveStatus) => void;
  onLastSaved?: (ts: number) => void;
  onSaveError?: (info: SaveErrorInfo) => void;
}): PersistenceAdapter {
  // ------- queues -------
  const insertJobs = new Map<string, InsertJob>();
  const updateJobs = new Map<string, UpdateJob>();
  const savingIds = new Set<string>();
  // Maps localId → serverId once insert resolves so updates can find it.
  const serverIdByLocal = new Map<string, string>();
  // localIds whose final save attempt failed permanently.
  const failedIds = new Set<string>();

  // ------- save-status aggregator -------
  let pending = 0;
  const reportIdle = () => {
    if (failedIds.size > 0) {
      onSaveStatus?.("error");
    } else {
      onSaveStatus?.("saved");
      onLastSaved?.(Date.now());
    }
  };
  const inc = () => {
    pending += 1;
    onSaveStatus?.("saving");
  };
  const decOk = () => {
    pending = Math.max(0, pending - 1);
    if (pending === 0) reportIdle();
  };
  // Transient: a retry is scheduled. Don't surface "error" yet.
  const decTransient = () => {
    pending = Math.max(0, pending - 1);
  };
  const decFinal = () => {
    pending = Math.max(0, pending - 1);
    onSaveStatus?.("error");
  };

  // ------- cache patching -------
  const cacheKey = ["blocks", projectId] as const;
  const patchCache = (updater: (rows: any[]) => any[]) => {
    queryClient.setQueryData<any[]>(cacheKey as any, (old) => updater(old ?? []));
  };

  // ------- helpers -------
  function scheduleRetry(fn: () => void, attempt: number) {
    const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
    setTimeout(fn, delay);
  }

  async function runInsert(localId: string) {
    const job = insertJobs.get(localId);
    if (!job) return;
    if (savingIds.has(localId)) return;
    if (serverIdByLocal.has(localId)) {
      insertJobs.delete(localId);
      return;
    }
    savingIds.add(localId);
    inc();
    try {
      const { data, error } = await supabase
        .from("script_blocks")
        .insert({
          project_id: projectId,
          block_type: job.row.block_type,
          content: job.row.content,
          order_index: job.row.order_index,
          metadata: job.row.metadata ?? {},
        })
        .select()
        .single();
      if (error) throw error;
      serverIdByLocal.set(localId, data.id);
      insertJobs.delete(localId);
      failedIds.delete(localId);
      patchCache((rows) =>
        rows.find((r) => r.id === data.id)
          ? rows
          : [...rows, data].sort((a, b) => a.order_index - b.order_index),
      );
      job.onServerId(data.id);
      decOk();
      const pendingUpdate = updateJobs.get(localId);
      if (pendingUpdate) {
        if (pendingUpdate.timer) clearTimeout(pendingUpdate.timer);
        pendingUpdate.timer = null;
        void runUpdate(localId);
      }
    } catch (e: any) {
      console.error("[persistence] insert failed", e);
      const next = job.attempt + 1;
      savingIds.delete(localId);
      if (next < RETRY_DELAYS_MS.length) {
        job.attempt = next;
        decTransient();
        scheduleRetry(() => void runInsert(localId), next);
        return;
      }
      // Final failure — keep the job in insertJobs so retryFailed() can pick it up.
      failedIds.add(localId);
      onSaveError?.({
        kind: "insert",
        localId,
        message: String(e?.message ?? e),
        attempts: next,
      });
      decFinal();
    } finally {
      savingIds.delete(localId);
    }
  }

  async function runUpdate(localId: string) {
    const job = updateJobs.get(localId);
    if (!job) return;
    const snap = job.getSnapshot();
    if (!snap) {
      updateJobs.delete(localId);
      return;
    }
    const serverId = snap.serverId ?? serverIdByLocal.get(localId);
    if (!serverId) {
      if (job.timer) clearTimeout(job.timer);
      job.timer = setTimeout(() => {
        job.timer = null;
        void runUpdate(localId);
      }, DEFER_WHEN_INSERTING_MS);
      return;
    }
    if (savingIds.has(localId)) {
      if (job.timer) clearTimeout(job.timer);
      job.timer = setTimeout(() => {
        job.timer = null;
        void runUpdate(localId);
      }, DEFER_WHEN_INSERTING_MS);
      return;
    }
    savingIds.add(localId);
    inc();
    const payload = {
      content: snap.content,
      block_type: snap.block_type,
      metadata: snap.metadata ?? {},
      order_index: snap.order_index,
    };
    try {
      const { error } = await supabase
        .from("script_blocks")
        .update(payload)
        .eq("id", serverId);
      if (error) throw error;
      patchCache((rows) => rows.map((r) => (r.id === serverId ? { ...r, ...payload } : r)));
      updateJobs.delete(localId);
      failedIds.delete(localId);
      decOk();
    } catch (e: any) {
      console.error("[persistence] update failed", e);
      const next = job.attempt + 1;
      savingIds.delete(localId);
      if (next < RETRY_DELAYS_MS.length) {
        job.attempt = next;
        decTransient();
        scheduleRetry(() => void runUpdate(localId), next);
        return;
      }
      failedIds.add(localId);
      onSaveError?.({
        kind: "update",
        localId,
        serverId,
        message: String(e?.message ?? e),
        attempts: next,
      });
      decFinal();
    } finally {
      savingIds.delete(localId);
    }
  }

  async function runDelete(serverId: string) {
    try {
      const { error } = await supabase.from("script_blocks").delete().eq("id", serverId);
      if (error) throw error;
      patchCache((rows) => rows.filter((r) => r.id !== serverId));
    } catch (e: any) {
      console.error("[persistence] delete failed", e);
      onSaveError?.({
        kind: "delete",
        serverId,
        message: String(e?.message ?? e),
        attempts: 1,
      });
    }
  }

  // ------- public adapter -------
  return {
    queueInsert(row, onServerId) {
      if (serverIdByLocal.has(row.localId)) {
        onServerId(serverIdByLocal.get(row.localId)!);
        return;
      }
      const existing = insertJobs.get(row.localId);
      if (existing) {
        existing.row = row;
        existing.onServerId = onServerId;
        return;
      }
      insertJobs.set(row.localId, { row, onServerId, attempt: 0 });
      onSaveStatus?.("dirty");
      setTimeout(() => void runInsert(row.localId), 0);
    },

    scheduleUpdate(localId, getSnapshot, delayMs = DEFAULT_UPDATE_DEBOUNCE_MS) {
      onSaveStatus?.("dirty");
      let job = updateJobs.get(localId);
      if (!job) {
        job = { getSnapshot, timer: null, attempt: 0 };
        updateJobs.set(localId, job);
      } else {
        job.getSnapshot = getSnapshot;
      }
      if (job.timer) clearTimeout(job.timer);
      job.timer = setTimeout(() => {
        job!.timer = null;
        void runUpdate(localId);
      }, delayMs);
    },

    queueDelete(serverId) {
      for (const [localId, mapped] of serverIdByLocal.entries()) {
        if (mapped !== serverId) continue;
        const ins = insertJobs.get(localId);
        if (ins) insertJobs.delete(localId);
        const upd = updateJobs.get(localId);
        if (upd?.timer) clearTimeout(upd.timer);
        updateJobs.delete(localId);
        serverIdByLocal.delete(localId);
        failedIds.delete(localId);
        break;
      }
      void runDelete(serverId);
    },

    cancelPending(localId) {
      const ins = insertJobs.get(localId);
      if (ins) insertJobs.delete(localId);
      const upd = updateJobs.get(localId);
      if (upd?.timer) clearTimeout(upd.timer);
      updateJobs.delete(localId);
      failedIds.delete(localId);
    },

    retryFailed() {
      const ids = Array.from(failedIds);
      if (ids.length === 0) return;
      for (const localId of ids) {
        failedIds.delete(localId);
        const ins = insertJobs.get(localId);
        if (ins) {
          ins.attempt = 0;
          setTimeout(() => void runInsert(localId), 0);
          continue;
        }
        const upd = updateJobs.get(localId);
        if (upd) {
          upd.attempt = 0;
          if (upd.timer) clearTimeout(upd.timer);
          upd.timer = setTimeout(() => {
            upd.timer = null;
            void runUpdate(localId);
          }, 0);
        }
      }
    },

    getFailedIds() {
      return new Set(failedIds);
    },
  };
}
