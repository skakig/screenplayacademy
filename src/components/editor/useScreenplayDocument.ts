import { useCallback, useEffect, useRef, useState } from "react";
import { NullPersistenceAdapter, type PersistenceAdapter, type PersistSnapshot } from "./screenplayPersistence";
import { formatBlockText } from "./screenplayAutoFormat";

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
  projectId: _projectId,
  initialBlocks,
  blocksLoading,
  onSaveStatus,
  onLastSaved: _onLastSaved,
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
        // Defer to next tick so the React commit happens before adapter callback.
        setTimeout(() => queueInsert(seed.id), 0);
        markDirty();
      } else {
        setActiveBlockId(initial[0].id);
      }
      setLocalBlocks(initial);
      hydratedOnce.current = true;
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
      // Preserve local-only (not yet persisted) blocks. Drop a single empty
      // seed if real server rows have arrived.
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
        prev.map((b) => {
          if (b.id !== localId) return b;
          // Apply safe formatting once for the new type (high-confidence only;
          // action/dialogue/note are passthrough trim).
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

  const deleteBlock = useCallback(
    (localId: string) => {
      const cur = blocksRef.current;
      const idx = cur.findIndex((b) => b.id === localId);
      if (idx < 0) return;
      // Never delete the final remaining block — clear it instead.
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
    insertAtEnd,
    deleteBlock,
    jumpToServer,
  };
}
