import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PersistenceAdapter, PersistSnapshot } from "./screenplayPersistence";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type LocalBlock = {
  id: string; // stable localId — used as React key forever
  serverId?: string; // Supabase UUID once persisted
  block_type: string;
  content: string;
  order_index: number;
  metadata?: any;
  status: "clean" | "dirty" | "saving" | "error";
};

function makeLocalId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function rowToLocal(r: any): LocalBlock {
  return {
    id: makeLocalId(),
    serverId: r.id,
    block_type: r.block_type,
    content: r.content ?? "",
    order_index: r.order_index,
    metadata: r.metadata,
    status: "clean",
  };
}

export function useScreenplayDocument({
  projectId,
  initialBlocks,
  blocksLoading,
  onSaveStatus,
  onLastSaved,
  onBlockCreated,
  persistence,
}: {
  projectId: string;
  initialBlocks: any[];
  blocksLoading?: boolean;
  onSaveStatus?: (s: SaveStatus) => void;
  onLastSaved?: (ts: number) => void;
  onBlockCreated?: (block_type: string) => void;
  /**
   * Optional persistence adapter. When provided, all I/O is routed through it
   * and the built-in Supabase path is bypassed. /editor-lab uses
   * NullPersistenceAdapter to run fully local.
   */
  persistence?: PersistenceAdapter;
}) {

  const qc = useQueryClient();
  const [localBlocks, setLocalBlocks] = useState<LocalBlock[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  const blocksRef = useRef<LocalBlock[]>([]);
  blocksRef.current = localBlocks;
  const dirtyIds = useRef<Set<string>>(new Set());
  const savingIds = useRef<Set<string>>(new Set());
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingCount = useRef(0);
  const hydratedOnce = useRef(false);

  // ---------- save status ----------
  const setStatus = useCallback((s: SaveStatus) => onSaveStatus?.(s), [onSaveStatus]);
  const markDirty = useCallback(() => setStatus("dirty"), [setStatus]);
  const incSaving = useCallback(() => {
    pendingCount.current += 1;
    setStatus("saving");
  }, [setStatus]);
  const decSavingOk = useCallback(() => {
    pendingCount.current = Math.max(0, pendingCount.current - 1);
    if (pendingCount.current === 0) {
      setStatus("saved");
      onLastSaved?.(Date.now());
    }
  }, [onLastSaved, setStatus]);
  const decSavingErr = useCallback(() => {
    pendingCount.current = Math.max(0, pendingCount.current - 1);
    setStatus("error");
  }, [setStatus]);

  // ---------- React Query cache patch ----------
  const patchCache = useCallback(
    (updater: (rows: any[]) => any[]) => {
      qc.setQueryData<any[]>(["blocks", projectId], (old) => updater(old ?? []));
    },
    [qc, projectId],
  );

  // ---------- persistence ----------
  // When an adapter is provided, route everything through it. Otherwise fall
  // back to the built-in Supabase path (production editor behavior).
  const queueInsert = useCallback(
    (localId: string) => {
      if (persistence) {
        const block = blocksRef.current.find((b) => b.id === localId);
        if (!block || block.serverId) return;
        markDirty();
        persistence.queueInsert(
          {
            localId,
            block_type: block.block_type,
            content: block.content,
            order_index: block.order_index,
            metadata: block.metadata,
          },
          (serverId) => {
            setLocalBlocks((prev) =>
              prev.map((b) =>
                b.id === localId
                  ? { ...b, serverId, status: dirtyIds.current.has(localId) ? "dirty" : "clean" }
                  : b,
              ),
            );
            onBlockCreated?.(block.block_type);
          },
        );
        return;
      }
      setTimeout(() => { void runInsert(localId); }, 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistence],
  );

  const scheduleUpdate = useCallback(
    (localId: string, delay = 600) => {
      if (persistence) {
        persistence.scheduleUpdate(
          localId,
          (): PersistSnapshot | undefined => {
            const b = blocksRef.current.find((x) => x.id === localId);
            if (!b) return undefined;
            return {
              localId,
              serverId: b.serverId,
              block_type: b.block_type,
              content: b.content,
              order_index: b.order_index,
              metadata: b.metadata,
            };
          },
          delay,
        );
        return;
      }
      const existing = saveTimers.current.get(localId);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        saveTimers.current.delete(localId);
        void runUpdate(localId);
      }, delay);
      saveTimers.current.set(localId, t);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistence],
  );


  async function runInsert(localId: string) {
    const block = blocksRef.current.find((b) => b.id === localId);
    if (!block || block.serverId) return;
    if (savingIds.current.has(localId)) return;
    savingIds.current.add(localId);
    incSaving();
    try {
      const { data, error } = await supabase
        .from("script_blocks")
        .insert({
          project_id: projectId,
          block_type: block.block_type,
          content: block.content,
          order_index: block.order_index,
          metadata: block.metadata ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      setLocalBlocks((prev) =>
        prev.map((b) =>
          b.id === localId
            ? { ...b, serverId: data.id, status: dirtyIds.current.has(localId) ? "dirty" : "clean" }
            : b,
        ),
      );
      patchCache((rows) =>
        rows.find((r) => r.id === data.id) ? rows : [...rows, data].sort((a, b) => a.order_index - b.order_index),
      );
      decSavingOk();
      onBlockCreated?.(block.block_type);
      // Snapshot content typed during insert; if it diverges from what we sent, push update.
      const fresh = blocksRef.current.find((b) => b.id === localId);
      if (fresh && (fresh.content !== block.content || fresh.block_type !== block.block_type)) {
        scheduleUpdate(localId, 200);
      }
    } catch {
      decSavingErr();
      setLocalBlocks((prev) => prev.map((b) => (b.id === localId ? { ...b, status: "error" } : b)));
    } finally {
      savingIds.current.delete(localId);
    }
  }

  async function runUpdate(localId: string) {
    const block = blocksRef.current.find((b) => b.id === localId);
    if (!block) return;
    if (!block.serverId) {
      // Not yet persisted. If insert is in-flight, it will pick up latest from ref.
      if (!savingIds.current.has(localId)) queueInsert(localId);
      return;
    }
    if (savingIds.current.has(localId)) {
      scheduleUpdate(localId, 400);
      return;
    }
    savingIds.current.add(localId);
    incSaving();
    const snap = {
      content: block.content,
      block_type: block.block_type,
      metadata: block.metadata ?? null,
    };
    try {
      const { error } = await supabase.from("script_blocks").update(snap).eq("id", block.serverId);
      if (error) throw error;
      patchCache((rows) => rows.map((r) => (r.id === block.serverId ? { ...r, ...snap } : r)));
      const fresh = blocksRef.current.find((b) => b.id === localId);
      const stillSame =
        fresh &&
        fresh.content === snap.content &&
        fresh.block_type === snap.block_type &&
        JSON.stringify(fresh.metadata ?? null) === JSON.stringify(snap.metadata);
      if (stillSame) {
        dirtyIds.current.delete(localId);
        setLocalBlocks((prev) => prev.map((b) => (b.id === localId ? { ...b, status: "clean" } : b)));
      } else {
        scheduleUpdate(localId, 300);
      }
      decSavingOk();
    } catch {
      decSavingErr();
      setLocalBlocks((prev) => prev.map((b) => (b.id === localId ? { ...b, status: "error" } : b)));
    } finally {
      savingIds.current.delete(localId);
    }
  }

  async function runDelete(serverId: string) {
    try {
      const { error } = await supabase.from("script_blocks").delete().eq("id", serverId);
      if (error) throw error;
      patchCache((rows) => rows.filter((r) => r.id !== serverId));
    } catch {
      // best-effort
    }
  }

  // ---------- hydration / server-echo merge ----------
  useEffect(() => {
    if (!hydratedOnce.current) {
      if (blocksLoading) return;
      const initial: LocalBlock[] = (initialBlocks || [])
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map(rowToLocal);
      if (initial.length === 0) {
        const seed: LocalBlock = {
          id: makeLocalId(),
          block_type: "scene_heading",
          content: "",
          order_index: 0,
          status: "dirty",
        };
        initial.push(seed);
        dirtyIds.current.add(seed.id);
        setActiveBlockId(seed.id);
        queueInsert(seed.id);
        markDirty();
      } else {
        setActiveBlockId(initial[0].id);
      }
      setLocalBlocks(initial);
      hydratedOnce.current = true;
      return;
    }

    // Subsequent server updates: merge for blocks that are not active/dirty/saving.
    setLocalBlocks((prev) => {
      const bySid = new Map(prev.filter((b) => b.serverId).map((b) => [b.serverId!, b]));
      const merged: LocalBlock[] = [];
      const seenLocalIds = new Set<string>();
      const incoming = (initialBlocks || []).slice().sort((a, b) => a.order_index - b.order_index);

      for (const r of incoming) {
        const existing = bySid.get(r.id);
        if (existing) {
          seenLocalIds.add(existing.id);
          const isActive = existing.id === activeBlockId;
          const isDirty = dirtyIds.current.has(existing.id);
          const isSaving = savingIds.current.has(existing.id);
          if (!isActive && !isDirty && !isSaving) {
            merged.push({
              ...existing,
              block_type: r.block_type,
              content: r.content ?? "",
              order_index: r.order_index,
              metadata: r.metadata,
              status: "clean",
            });
          } else {
            merged.push({ ...existing, order_index: r.order_index });
          }
        } else {
          merged.push(rowToLocal(r));
        }
      }
      // Preserve local-only (not yet persisted) blocks. Drop a single empty
      // seed if real server rows have arrived (avoids duplicate scene heading
      // after bulk template insert).
      const localOnly = prev.filter((b) => !b.serverId && !seenLocalIds.has(b.id));
      const dropSeed =
        merged.length > 0 &&
        localOnly.length === 1 &&
        localOnly[0].content === "" &&
        localOnly[0].block_type === "scene_heading" &&
        !dirtyIds.current.has(localOnly[0].id);
      if (!dropSeed) merged.push(...localOnly);
      merged.sort((a, b) => a.order_index - b.order_index);
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBlocks, blocksLoading]);

  // ---------- public mutators ----------
  const updateBlockContent = useCallback(
    (localId: string, content: string) => {
      setLocalBlocks((prev) =>
        prev.map((b) => (b.id === localId ? { ...b, content, status: "dirty" } : b)),
      );
      dirtyIds.current.add(localId);
      markDirty();
      scheduleUpdate(localId);
    },
    [markDirty, scheduleUpdate],
  );

  const changeBlockType = useCallback(
    (localId: string, type: string) => {
      setLocalBlocks((prev) =>
        prev.map((b) => (b.id === localId ? { ...b, block_type: type, status: "dirty" } : b)),
      );
      dirtyIds.current.add(localId);
      markDirty();
      scheduleUpdate(localId, 200);
    },
    [markDirty, scheduleUpdate],
  );

  const updateBlockMetadata = useCallback(
    (localId: string, metadata: any) => {
      setLocalBlocks((prev) =>
        prev.map((b) => (b.id === localId ? { ...b, metadata, status: "dirty" } : b)),
      );
      dirtyIds.current.add(localId);
      markDirty();
      scheduleUpdate(localId, 200);
    },
    [markDirty, scheduleUpdate],
  );

  const insertBlockAfter = useCallback(
    (afterLocalId: string | null, blockType: string, initialContent = ""): string => {
      const cur = blocksRef.current;
      let idx = afterLocalId ? cur.findIndex((b) => b.id === afterLocalId) : cur.length - 1;
      if (idx < 0) idx = cur.length - 1;
      const after = idx >= 0 ? cur[idx] : undefined;
      const before = cur[idx + 1];
      const newOrder =
        after && before
          ? (after.order_index + before.order_index) / 2
          : after
            ? after.order_index + 1
            : 0;
      const nb: LocalBlock = {
        id: makeLocalId(),
        block_type: blockType,
        content: initialContent,
        order_index: newOrder,
        status: "dirty",
      };
      dirtyIds.current.add(nb.id);
      setLocalBlocks((prev) => {
        const arr = [...prev];
        const i = afterLocalId ? arr.findIndex((b) => b.id === afterLocalId) : arr.length - 1;
        const at = i < 0 ? arr.length : i + 1;
        arr.splice(at, 0, nb);
        return arr;
      });
      markDirty();
      setActiveBlockId(nb.id);
      queueInsert(nb.id);
      return nb.id;
    },
    [markDirty, queueInsert],
  );

  const insertAtEnd = useCallback(
    (blockType: string) => {
      const cur = blocksRef.current;
      return insertBlockAfter(cur.length > 0 ? cur[cur.length - 1].id : null, blockType);
    },
    [insertBlockAfter],
  );

  const deleteBlock = useCallback((localId: string) => {
    const cur = blocksRef.current;
    const idx = cur.findIndex((b) => b.id === localId);
    if (idx < 0) return;
    const prevBlock = cur[idx - 1] ?? cur[idx + 1];
    const target = cur[idx];
    setLocalBlocks((prev) => prev.filter((b) => b.id !== localId));
    dirtyIds.current.delete(localId);
    if (prevBlock) setActiveBlockId(prevBlock.id);
    const t = saveTimers.current.get(localId);
    if (t) {
      clearTimeout(t);
      saveTimers.current.delete(localId);
    }
    if (target?.serverId) void runDelete(target.serverId);
  }, []);

  const jumpToServer = useCallback((serverId: string) => {
    const b = blocksRef.current.find((x) => x.serverId === serverId);
    if (b) setActiveBlockId(b.id);
  }, []);

  return {
    localBlocks,
    activeBlockId,
    setActiveBlockId,
    updateBlockContent,
    changeBlockType,
    updateBlockMetadata,
    insertBlockAfter,
    insertAtEnd,
    deleteBlock,
    jumpToServer,
  };
}
