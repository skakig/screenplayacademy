import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { isLiveSceneCollabEnabled } from "@/lib/featureFlags";
import type { ProjectRole } from "@/components/writers-room/roles";
import type { SceneLockRow } from "@/lib/assignments";

import {
  canStartLiveSession,
  canJoinLiveSession,
  isSceneEntryAllowed,
} from "./permissions";
import { useConflictQueue } from "./conflictQueue";
import type {
  HeldRemoteChange,
  LiveBlockUpdateEvent,
  LiveConnectionState,
  LiveParticipant,
} from "./types";

interface SelfIdentity {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface UseLiveSceneSessionArgs {
  projectId: string;
  sceneId: string | null;
  role: ProjectRole | null;
  self: SelfIdentity | null;
  activeLock?: SceneLockRow | null;
}

interface LocalEditorState {
  /** Block IDs the local user is actively focused/editing. */
  focusedBlockIds: ReadonlySet<string>;
  /** Block IDs the local user has unsaved/dirty changes for. */
  dirtyBlockIds: ReadonlySet<string>;
  /** Lookup: script_block_id -> last known revision + content. */
  blockSnapshots: ReadonlyMap<
    string,
    { revision: number; content: string }
  >;
}

const OUTBOUND_DEBOUNCE_MS = 500;

function channelName(projectId: string, sceneId: string): string {
  return `scene-collab:${projectId}:${sceneId}`;
}

function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Live scene collaboration hook (Pass 7 — experimental, text-update only).
 *
 * Guardrails:
 *   - Feature flag must be on.
 *   - User must be authed AND hold an editor-tier role.
 *   - Scene must not be hard-locked by someone else (unless override).
 *   - Realtime payloads carry one block delta — never full screenplay.
 *   - Remote applies are safe-only: skipped & queued for dirty/focused blocks
 *     or revision mismatches.
 *   - Echo loop guard: receiver ignores events with actor_id === self.
 */
export function useLiveSceneSession({
  projectId,
  sceneId,
  role,
  self,
  activeLock,
}: UseLiveSceneSessionArgs) {
  const queryClient = useQueryClient();
  const conflicts = useConflictQueue();

  const [active, setActive] = useState(false);
  const [connection, setConnection] = useState<LiveConnectionState>("idle");
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<
    null | "permission" | "locked" | "flag_off" | "unknown"
  >(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const editorStateRef = useRef<LocalEditorState>({
    focusedBlockIds: new Set(),
    dirtyBlockIds: new Set(),
    blockSnapshots: new Map(),
  });
  const pendingOutbound = useRef<
    Map<string, { timer: ReturnType<typeof setTimeout>; payload: LiveBlockUpdateEvent }>
  >(new Map());

  const flagOn = isLiveSceneCollabEnabled();

  const canStart = useMemo(() => {
    if (!flagOn) return false;
    if (!self || !sceneId) return false;
    if (!canStartLiveSession(role)) return false;
    const entry = isSceneEntryAllowed(activeLock ?? null, self.user_id, role);
    return entry.allowed;
  }, [flagOn, self, sceneId, role, activeLock]);

  const canJoin = useMemo(() => {
    if (!flagOn) return false;
    if (!self || !sceneId) return false;
    if (!canJoinLiveSession(role)) return false;
    const entry = isSceneEntryAllowed(activeLock ?? null, self.user_id, role);
    return entry.allowed;
  }, [flagOn, self, sceneId, role, activeLock]);

  // Provide a way for the bridge UI to update its view of the editor.
  const reportEditorState = useCallback((next: Partial<LocalEditorState>) => {
    editorStateRef.current = {
      ...editorStateRef.current,
      ...next,
    } as LocalEditorState;
  }, []);

  const teardown = useCallback(
    async (markEnded: boolean) => {
      // Flush pending outbound events on graceful leave.
      for (const [, p] of pendingOutbound.current) clearTimeout(p.timer);
      pendingOutbound.current.clear();

      const ch = channelRef.current;
      if (ch) {
        try {
          await ch.untrack();
        } catch {
          /* noop */
        }
        await supabase.removeChannel(ch);
      }
      channelRef.current = null;

      if (markEnded && sessionId) {
        try {
          await supabase
            .from("live_scene_sessions")
            .update({ status: "ended", ended_at: new Date().toISOString() })
            .eq("id", sessionId);
        } catch {
          /* best-effort */
        }
      }

      setSessionId(null);
      setParticipants([]);
      setActive(false);
      setConnection("idle");
      conflicts.clear();
    },
    [sessionId, conflicts],
  );

  const subscribe = useCallback(
    async (sId: string) => {
      if (!self || !sceneId) return;
      setConnection("connecting");

      const channel = supabase.channel(channelName(projectId, sceneId), {
        config: { presence: { key: self.user_id } },
      });
      channelRef.current = channel;

      const syncParticipants = () => {
        const raw = channel.presenceState() as Record<
          string,
          LiveParticipant[]
        >;
        const out: LiveParticipant[] = [];
        for (const list of Object.values(raw)) {
          const latest = list[list.length - 1];
          if (!latest?.user_id) continue;
          out.push({ ...latest, is_self: latest.user_id === self.user_id });
        }
        setParticipants(out);
      };

      channel
        .on("presence", { event: "sync" }, syncParticipants)
        .on("presence", { event: "join" }, syncParticipants)
        .on("presence", { event: "leave" }, syncParticipants)
        .on("broadcast", { event: "block_update" }, ({ payload }) => {
          applyIncoming(payload as LiveBlockUpdateEvent);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setConnection("connected");
            void channel.track({
              user_id: self.user_id,
              display_name: self.display_name ?? null,
              avatar_url: self.avatar_url ?? null,
              role: role ?? null,
            });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setConnection("reconnecting");
          } else if (status === "CLOSED") {
            setConnection("disconnected");
          }
        });

      void sId; // sId carried for future change_events logging
    },
    // applyIncoming is stable via ref usage below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, sceneId, self, role],
  );

  const applyIncoming = useCallback(
    (evt: LiveBlockUpdateEvent) => {
      if (!self || !sceneId) return;
      // Echo guard.
      if (evt.actor_id === self.user_id) return;
      // Flag may have flipped or scene changed.
      if (!isLiveSceneCollabEnabled()) return;
      if (evt.project_id !== projectId || evt.scene_id !== sceneId) return;

      // Only update_text is supported in Pass 7A.
      if (evt.operation !== "update_text") {
        conflicts.push({
          id: newEventId(),
          projectId,
          sceneId,
          scriptBlockId: evt.script_block_id,
          localBlockId: evt.local_block_id,
          actorId: evt.actor_id,
          actorName: evt.actor_name,
          operation: evt.operation,
          incomingText: evt.text,
          reason: "unsupported_operation",
          receivedAt: new Date().toISOString(),
        });
        return;
      }

      const blockId = evt.script_block_id;
      if (!blockId) return;

      const state = editorStateRef.current;
      const snap = state.blockSnapshots.get(blockId);

      // Missing block locally → hold for review.
      if (!snap) {
        conflicts.push({
          id: newEventId(),
          projectId,
          sceneId,
          scriptBlockId: blockId,
          actorId: evt.actor_id,
          actorName: evt.actor_name,
          operation: evt.operation,
          incomingText: evt.text,
          reason: "missing_block",
          receivedAt: new Date().toISOString(),
        });
        return;
      }

      // Locally focused or dirty → never silently overwrite.
      if (
        state.focusedBlockIds.has(blockId) ||
        state.dirtyBlockIds.has(blockId)
      ) {
        conflicts.push({
          id: newEventId(),
          projectId,
          sceneId,
          scriptBlockId: blockId,
          actorId: evt.actor_id,
          actorName: evt.actor_name,
          operation: evt.operation,
          incomingText: evt.text,
          localText: snap.content,
          reason: "local_dirty",
          receivedAt: new Date().toISOString(),
        });
        return;
      }

      // Revision drift → hold.
      if (
        typeof evt.base_revision === "number" &&
        evt.base_revision !== snap.revision
      ) {
        conflicts.push({
          id: newEventId(),
          projectId,
          sceneId,
          scriptBlockId: blockId,
          actorId: evt.actor_id,
          actorName: evt.actor_name,
          operation: evt.operation,
          incomingText: evt.text,
          localText: snap.content,
          reason: "revision_mismatch",
          receivedAt: new Date().toISOString(),
        });
        return;
      }

      // Safe to apply: patch the snapshot. The editor's own query/state owns
      // the real apply path — this hook only updates the live snapshot so
      // subsequent conflict checks compare against the new baseline. Visible
      // application happens via `subscribe to remote updates` consumers.
      const nextSnapshots = new Map(state.blockSnapshots);
      nextSnapshots.set(blockId, {
        revision: (evt.base_revision ?? snap.revision) + 1,
        content: evt.text ?? "",
      });
      editorStateRef.current = {
        ...editorStateRef.current,
        blockSnapshots: nextSnapshots,
      };

      // Fan out to consumers (Live Lab panel reads from `lastRemoteApply`).
      setLastRemoteApply({ blockId, text: evt.text ?? "", at: Date.now() });

      // Invalidate the scene's blocks query so canonical state is re-read.
      // We do this lazily so we don't disturb active typing on other blocks.
      void queryClient.invalidateQueries({
        queryKey: ["script_blocks", projectId, sceneId],
        exact: false,
      });
    },
    [self, sceneId, projectId, conflicts, queryClient],
  );

  const [lastRemoteApply, setLastRemoteApply] = useState<{
    blockId: string;
    text: string;
    at: number;
  } | null>(null);

  const start = useCallback(async () => {
    setError(null);
    if (!flagOn) {
      setError("flag_off");
      return;
    }
    if (!canStart || !sceneId || !self) {
      setError("permission");
      return;
    }
    try {
      const { data, error: insErr } = await supabase
        .from("live_scene_sessions")
        .insert({
          project_id: projectId,
          scene_id: sceneId,
          started_by: self.user_id,
          status: "active",
        })
        .select("id")
        .single();
      if (insErr || !data) {
        setError("unknown");
        return;
      }
      setSessionId(data.id);
      setActive(true);
      await subscribe(data.id);
    } catch {
      setError("unknown");
    }
  }, [flagOn, canStart, sceneId, self, projectId, subscribe]);

  const join = useCallback(async () => {
    setError(null);
    if (!flagOn) {
      setError("flag_off");
      return;
    }
    if (!canJoin || !sceneId || !self) {
      setError("permission");
      return;
    }
    try {
      // Latest active session for this scene (if any). If none, behave like start.
      const { data } = await supabase
        .from("live_scene_sessions")
        .select("id")
        .eq("scene_id", sceneId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1);
      const existing = data?.[0]?.id ?? null;
      if (existing) {
        setSessionId(existing);
        setActive(true);
        await subscribe(existing);
      } else {
        await start();
      }
    } catch {
      setError("unknown");
    }
  }, [flagOn, canJoin, sceneId, self, subscribe, start]);

  const leave = useCallback(async () => {
    await teardown(true);
  }, [teardown]);

  // Hard guard: tear down on scene change / unmount / flag flip.
  useEffect(() => {
    if (!flagOn && active) {
      void teardown(false);
    }
  }, [flagOn, active, teardown]);

  useEffect(() => {
    return () => {
      // Best-effort cleanup; do NOT mark ended (other clients may still be live).
      void teardown(false);
    };
    // Only on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outbound emit (debounced per block).
  const emitTextUpdate = useCallback(
    (args: {
      script_block_id: string;
      base_revision: number;
      text: string;
    }) => {
      if (!active || !channelRef.current || !self || !sceneId) return;
      if (!isLiveSceneCollabEnabled()) return;
      // Skip if locked by another.
      if (
        activeLock &&
        !activeLock.released_at &&
        activeLock.locked_by !== self.user_id &&
        role !== "owner" &&
        role !== "editor"
      ) {
        return;
      }

      const prev = pendingOutbound.current.get(args.script_block_id);
      if (prev) clearTimeout(prev.timer);

      const payload: LiveBlockUpdateEvent = {
        event_id: newEventId(),
        project_id: projectId,
        scene_id: sceneId,
        script_block_id: args.script_block_id,
        actor_id: self.user_id,
        actor_name: self.display_name ?? null,
        operation: "update_text",
        base_revision: args.base_revision,
        text: args.text,
        client_timestamp: new Date().toISOString(),
        origin: "local",
      };

      const timer = setTimeout(() => {
        pendingOutbound.current.delete(args.script_block_id);
        const ch = channelRef.current;
        if (!ch) return;
        void ch.send({
          type: "broadcast",
          event: "block_update",
          payload,
        });
        // Update local snapshot so we don't echo-conflict our own send.
        const state = editorStateRef.current;
        const next = new Map(state.blockSnapshots);
        next.set(args.script_block_id, {
          revision: args.base_revision + 1,
          content: args.text,
        });
        editorStateRef.current = {
          ...editorStateRef.current,
          blockSnapshots: next,
        };
      }, OUTBOUND_DEBOUNCE_MS);

      pendingOutbound.current.set(args.script_block_id, { timer, payload });
    },
    [active, self, sceneId, projectId, activeLock, role],
  );

  /** Conflict resolution: "use theirs" — apply incoming text to local snapshot. */
  const acceptIncoming = useCallback(
    (c: HeldRemoteChange) => {
      if (!c.scriptBlockId) {
        conflicts.dismiss(c.id);
        return;
      }
      const state = editorStateRef.current;
      const snap = state.blockSnapshots.get(c.scriptBlockId);
      const next = new Map(state.blockSnapshots);
      next.set(c.scriptBlockId, {
        revision: (snap?.revision ?? 1) + 1,
        content: c.incomingText ?? "",
      });
      editorStateRef.current = {
        ...editorStateRef.current,
        blockSnapshots: next,
      };
      setLastRemoteApply({
        blockId: c.scriptBlockId,
        text: c.incomingText ?? "",
        at: Date.now(),
      });
      conflicts.dismiss(c.id);
      void queryClient.invalidateQueries({
        queryKey: ["script_blocks", projectId, sceneId],
        exact: false,
      });
    },
    [conflicts, queryClient, projectId, sceneId],
  );

  return {
    flagOn,
    canStart,
    canJoin,
    active,
    connection,
    participants,
    error,
    conflicts: conflicts.items,
    lastRemoteApply,
    start,
    join,
    leave,
    emitTextUpdate,
    reportEditorState,
    acceptIncoming,
    dismissConflict: conflicts.dismiss,
  };
}

export type UseLiveSceneSessionReturn = ReturnType<typeof useLiveSceneSession>;
