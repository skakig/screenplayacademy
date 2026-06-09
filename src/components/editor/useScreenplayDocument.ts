import { useCallback, useEffect, useRef, useState } from "react";
import { NullPersistenceAdapter, type PersistenceAdapter, type PersistSnapshot } from "./screenplayPersistence";
import { formatBlockText } from "./screenplayAutoFormat";
import { readDraft, writeDraft } from "./draftBackup";

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
  onLastSaved: _onLastSaved,
  onBlockCreated,
  onDraftRestored,
  persistence,
}: {
  projectId: string;
  initialBlocks: any[];
  blocksLoading?: boolean;
  onSaveStatus?: (s: SaveStatus) => void;
  onLastSaved?: (ts: number) => void;
  onBlockCreated?: (block_type: string) => void;
  /**
   * Called once on mount if a local draft contained unsaved blocks that
   * weren't on the server. Reports how many lines were restored so the
   * UI can show a toast.
   */
  onDraftRestored?: (count: number) => void;
  /**
   * Persistence adapter. All I/O is routed through it. Defaults to
   * NullPersistenceAdapter so the hook stays fully local when no adapter
   * is supplied (used by /editor-lab Null mode and tests).
   */
  persistence?: PersistenceAdapter;
}) {
  const adapter = persistence ?? NullPersistenceAdapter;

  const [localBlocks, setLocalBlocks] = useState<LocalBlock[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  const blocksRef = useRef<LocalBlock[]>([]);
  blocksRef.current = localBlocks;
  const dirtyIds = useRef<Set<string>>(new Set());
  const hydratedOnce = useRef(false);

  const markDirty = useCallback(() => onSaveStatus?.("dirty"), [onSaveStatus]);

  // ---------- persistence ----------
  const queueInsert = useCallback(
    (localId: string) => {
      const block = blocksRef.current.find((b) => b.id === localId);
      if (!block || block.serverId) return;
      markDirty();
      adapter.queueInsert(
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
    },
    [adapter, markDirty, onBlockCreated],
  );

  const scheduleUpdate = useCallback(
    (localId: string, delay = 600) => {
      adapter.scheduleUpdate(
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
    },
    [adapter],
  );

  // ---------- hydration / server-echo merge + draft restore ----------
  useEffect(() => {
    if (!hydratedOnce.current) {
      if (blocksLoading) return;
      const initial: LocalBlock[] = (initialBlocks || [])
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map(rowToLocal);

      // ----- restore unsaved blocks from a previous session, if any -----
      const restoredInserts: string[] = [];
      try {
        const draft = projectId ? readDraft(projectId) : null;
        if (draft && Array.isArray(draft.blocks) && draft.blocks.length > 0) {
          const serverIds = new Set(initial.map((b) => b.serverId).filter(Boolean) as string[]);
          // Dedupe by content + nearby order_index so we don't double-up
          // a line that's already on the server.
          const seenContent = new Set(
            initial.map((b) => `${b.block_type}|${(b.content || "").trim()}`),
          );
          const maxOrder = initial.length > 0
            ? Math.max(...initial.map((b) => b.order_index))
            : -1;
          let nextOrder = maxOrder + 1;
          for (const d of draft.blocks) {
            const content = (d.content || "").toString();
            if (!content.trim()) continue;
            if (d.serverId && serverIds.has(d.serverId)) continue;
            const key = `${d.block_type}|${content.trim()}`;
            if (seenContent.has(key)) continue;
            seenContent.add(key);
            const nb: LocalBlock = {
              id: makeLocalId(),
              block_type: (d.block_type as string) || "action",
              content,
              order_index: nextOrder++,
              metadata: d.metadata,
              status: "dirty",
            };
            initial.push(nb);
            dirtyIds.current.add(nb.id);
            restoredInserts.push(nb.id);
          }
        }
      } catch {
        // ignore
      }

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
        setTimeout(() => queueInsert(seed.id), 0);
        markDirty();
      } else {
        setActiveBlockId(initial[0].id);
      }
      setLocalBlocks(initial);
      hydratedOnce.current = true;
      if (restoredInserts.length > 0) {
        // Queue inserts for restored blocks on next tick (state needs to commit
        // so blocksRef sees them).
        setTimeout(() => {
          for (const id of restoredInserts) queueInsert(id);
          onDraftRestored?.(restoredInserts.length);
        }, 0);
      }
      return;
    }

    // Subsequent server updates: merge for blocks that are not active/dirty.
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
          if (!isActive && !isDirty) {
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

  // ---------- local-first draft mirror to localStorage ----------
  useEffect(() => {
    if (!projectId) return;
    if (!hydratedOnce.current) return;
    const t = setTimeout(() => {
      writeDraft(projectId, blocksRef.current);
    }, 400);
    return () => clearTimeout(t);
  }, [projectId, localBlocks]);

  // Synchronous flush on unload so the last keystroke is captured.
  useEffect(() => {
    if (!projectId) return;
    const handler = () => {
      try {
        writeDraft(projectId, blocksRef.current);
      } catch {
        // noop
      }
    };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
    };
  }, [projectId]);

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
        prev.map((b) => {
          if (b.id !== localId) return b;
          const formatted = formatBlockText(type, b.content);
          return { ...b, block_type: type, content: formatted, status: "dirty" };
        }),
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
      const insertAt = idx + 1;
      const before = cur[insertAt];

      // CRITICAL: order_index is INTEGER in Postgres. Using `(after+before)/2`
      // produced fractional values that Postgres silently rejected, causing
      // data loss. Instead, place the new block at `after+1` and renumber
      // every block from `before` onward by +1 when there's no integer gap.
      const afterOrder = after?.order_index ?? -1;
      const newOrder = afterOrder + 1;
      const needsRenumber = before !== undefined && newOrder >= before.order_index;
      const shiftedIds: string[] = needsRenumber
        ? cur.slice(insertAt).map((b) => b.id)
        : [];

      const nb: LocalBlock = {
        id: makeLocalId(),
        block_type: blockType,
        content: initialContent,
        order_index: newOrder,
        status: "dirty",
      };
      dirtyIds.current.add(nb.id);
      for (const sid of shiftedIds) dirtyIds.current.add(sid);

      setLocalBlocks((prev) => {
        const arr = [...prev];
        const i = afterLocalId ? arr.findIndex((b) => b.id === afterLocalId) : arr.length - 1;
        const at = i < 0 ? arr.length : i + 1;
        if (needsRenumber) {
          for (let j = at; j < arr.length; j++) {
            arr[j] = { ...arr[j], order_index: arr[j].order_index + 1, status: "dirty" };
          }
        }
        arr.splice(at, 0, nb);
        return arr;
      });
      markDirty();
      setActiveBlockId(nb.id);
      queueInsert(nb.id);
      for (const sid of shiftedIds) scheduleUpdate(sid, 200);
      return nb.id;
    },
    [markDirty, queueInsert, scheduleUpdate],
  );

  const insertAtEnd = useCallback(
    (blockType: string) => {
      const cur = blocksRef.current;
      return insertBlockAfter(cur.length > 0 ? cur[cur.length - 1].id : null, blockType);
    },
    [insertBlockAfter],
  );

  /**
   * Batch-insert N blocks after a given anchor in a single state transaction.
   * Returns the localIds in insertion order.
   */
  const insertBlocksAfter = useCallback(
    (
      afterLocalId: string | null,
      defs: Array<{ block_type: string; content: string; metadata?: any }>,
    ): string[] => {
      if (defs.length === 0) return [];
      const cur = blocksRef.current;
      let idx = afterLocalId ? cur.findIndex((b) => b.id === afterLocalId) : cur.length - 1;
      if (idx < 0) idx = cur.length - 1;
      const insertAt = idx + 1;
      const after = idx >= 0 ? cur[idx] : undefined;
      const before = cur[insertAt];

      const afterOrder = after?.order_index ?? -1;
      const newBlocks: LocalBlock[] = defs.map((d, i) => ({
        id: makeLocalId(),
        block_type: d.block_type,
        content: d.content,
        order_index: afterOrder + 1 + i,
        metadata: d.metadata,
        status: "dirty",
      }));
      const shiftBy = newBlocks.length;
      const needsRenumber =
        before !== undefined && newBlocks[newBlocks.length - 1].order_index >= before.order_index;
      const shiftedIds: string[] = needsRenumber ? cur.slice(insertAt).map((b) => b.id) : [];

      for (const nb of newBlocks) dirtyIds.current.add(nb.id);
      for (const sid of shiftedIds) dirtyIds.current.add(sid);

      setLocalBlocks((prev) => {
        const arr = [...prev];
        const i = afterLocalId ? arr.findIndex((b) => b.id === afterLocalId) : arr.length - 1;
        const at = i < 0 ? arr.length : i + 1;
        if (needsRenumber) {
          for (let j = at; j < arr.length; j++) {
            arr[j] = { ...arr[j], order_index: arr[j].order_index + shiftBy, status: "dirty" };
          }
        }
        arr.splice(at, 0, ...newBlocks);
        return arr;
      });
      markDirty();
      setActiveBlockId(newBlocks[newBlocks.length - 1].id);
      for (const nb of newBlocks) queueInsert(nb.id);
      for (const sid of shiftedIds) scheduleUpdate(sid, 200);
      return newBlocks.map((b) => b.id);
    },
    [markDirty, queueInsert, scheduleUpdate],
  );

  const deleteBlock = useCallback(
    (localId: string) => {
      const cur = blocksRef.current;
      const idx = cur.findIndex((b) => b.id === localId);
      if (idx < 0) return;
      if (cur.length <= 1) {
        setLocalBlocks((prev) =>
          prev.map((b) =>
            b.id === localId ? { ...b, content: "", block_type: "scene_heading", status: "dirty" } : b,
          ),
        );
        dirtyIds.current.add(localId);
        markDirty();
        scheduleUpdate(localId, 200);
        return;
      }
      const prevBlock = cur[idx - 1] ?? cur[idx + 1];
      const target = cur[idx];
      setLocalBlocks((prev) => prev.filter((b) => b.id !== localId));
      dirtyIds.current.delete(localId);
      if (prevBlock) setActiveBlockId(prevBlock.id);
      adapter.cancelPending?.(localId);
      if (target?.serverId) adapter.queueDelete(target.serverId);
    },
    [adapter, markDirty, scheduleUpdate],
  );

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
    insertBlocksAfter,
    insertAtEnd,
    deleteBlock,
    jumpToServer,
  };
}
