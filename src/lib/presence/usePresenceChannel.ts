import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { ProjectRole } from "@/components/writers-room/roles";

import type { PresenceArea, PresencePeer, ProjectPresenceState } from "./types";

interface SelfIdentity {
  user_id: string;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

interface Options {
  projectId: string;
  /** Resolved project role. Null/undefined = no access, do not subscribe. */
  role: ProjectRole | null | undefined;
  /** Loaded current user. Null = not signed in, do not subscribe. */
  self: SelfIdentity | null;
}

const TRACK_THROTTLE_MS = 2500;
// Grace window kept long enough that natural intra-word pauses don't clear
// the "typing…" indicator and cause it to flicker between key presses.
const TYPING_CLEAR_MS = 3500;
// Once the indicator turns off, require this minimum quiet window before we
// broadcast "typing=true" again. Prevents rapid true/false/true churn.
const TYPING_MIN_OFF_MS = 1200;
const LAST_SEEN_TICK_MS = 60_000;
/**
 * How long a peer can go without refreshing their presence payload before
 * we render them as idle. Comfortably longer than TRACK_THROTTLE_MS +
 * TYPING_CLEAR_MS so a normal typing burst never trips it.
 */
const IDLE_AFTER_MS = 45_000;
/** How often we re-derive idle state. Kept slow to avoid re-render churn. */
const IDLE_TICK_MS = 10_000;

/**
 * Lightweight project-scoped Supabase Realtime presence hook.
 *
 * Guardrails:
 *   - Subscribes ONLY after access is confirmed (role + self present).
 *   - Throttles `track()` calls so navigation/typing pings stay cheap.
 *   - Cleans up on unmount, projectId change, role loss, or sign-out.
 *   - Never carries script text, selection, or prompt data in payloads.
 */
export function usePresenceChannel({ projectId, role, self }: Options) {
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [connected, setConnected] = useState(false);

  const stateRef = useRef<ProjectPresenceState | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTrackAt = useRef(0);
  const pendingTrack = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingOffAt = useRef(0);

  const canSubscribe = !!projectId && !!role && !!self?.user_id;

  // Build initial state when identity is ready.
  useEffect(() => {
    if (!canSubscribe || !self) {
      stateRef.current = null;
      return;
    }
    stateRef.current = {
      user_id: self.user_id,
      display_name: self.display_name ?? null,
      email: self.email ?? null,
      avatar_url: self.avatar_url ?? null,
      role: role ?? null,
      project_id: projectId,
      active_area: "writers_room",
      active_scene_id: null,
      active_scene_label: null,
      is_typing_scene_id: null,
      active_block_id: null,
      last_active_at: new Date().toISOString(),
    };
  }, [canSubscribe, self, role, projectId]);

  const trackNow = useCallback(() => {
    const ch = channelRef.current;
    const s = stateRef.current;
    if (!ch || !s) return;
    lastTrackAt.current = Date.now();
    s.last_active_at = new Date().toISOString();
    void ch.track(s);
  }, []);

  const scheduleTrack = useCallback(() => {
    if (!channelRef.current || !stateRef.current) return;
    const delta = Date.now() - lastTrackAt.current;
    if (delta >= TRACK_THROTTLE_MS) {
      trackNow();
      return;
    }
    if (pendingTrack.current) return;
    pendingTrack.current = setTimeout(() => {
      pendingTrack.current = null;
      trackNow();
    }, TRACK_THROTTLE_MS - delta);
  }, [trackNow]);

  // Subscribe lifecycle.
  useEffect(() => {
    if (!canSubscribe || !self) {
      setPeers([]);
      setConnected(false);
      return;
    }

    const channelName = `project-presence:${projectId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: self.user_id } },
    });
    channelRef.current = channel;

    const sync = () => {
      const raw = channel.presenceState() as Record<string, ProjectPresenceState[]>;
      const out: PresencePeer[] = [];
      const now = Date.now();
      for (const list of Object.values(raw)) {
        const latest = list[list.length - 1];
        if (!latest || !latest.user_id) continue;
        const lastActive = Date.parse(latest.last_active_at ?? "") || 0;
        const isSelf = latest.user_id === self.user_id;
        const isIdle = !isSelf && lastActive > 0 && now - lastActive > IDLE_AFTER_MS;
        out.push({ ...latest, is_self: isSelf, is_idle: isIdle });
      }
      // Deduplicate by user_id keeping the most recent last_active_at.
      const byUser = new Map<string, PresencePeer>();
      for (const p of out) {
        const prev = byUser.get(p.user_id);
        if (!prev || prev.last_active_at < p.last_active_at) byUser.set(p.user_id, p);
      }
      setPeers(Array.from(byUser.values()));
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          trackNow();
          // Bump last_seen in project_members. Best-effort; no UI blocking.
          void supabase.rpc("update_my_project_last_seen", {
            _project_id: projectId,
          });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });

    const lastSeenInterval = setInterval(() => {
      void supabase.rpc("update_my_project_last_seen", { _project_id: projectId });
    }, LAST_SEEN_TICK_MS);

    return () => {
      clearInterval(lastSeenInterval);
      if (pendingTrack.current) {
        clearTimeout(pendingTrack.current);
        pendingTrack.current = null;
      }
      if (typingClearTimer.current) {
        clearTimeout(typingClearTimer.current);
        typingClearTimer.current = null;
      }
      try {
        void channel.untrack();
      } catch {
        /* noop */
      }
      void supabase.removeChannel(channel);
      channelRef.current = null;
      setPeers([]);
      setConnected(false);
    };
  }, [canSubscribe, self, projectId, trackNow]);

  const setActiveArea = useCallback(
    (area: PresenceArea) => {
      const s = stateRef.current;
      if (!s || s.active_area === area) return;
      s.active_area = area;
      scheduleTrack();
    },
    [scheduleTrack],
  );

  const setActiveScene = useCallback(
    (sceneId: string | null, sceneLabel: string | null) => {
      const s = stateRef.current;
      if (!s) return;
      if (s.active_scene_id === sceneId && s.active_scene_label === sceneLabel) return;
      s.active_scene_id = sceneId;
      s.active_scene_label = sceneLabel;
      // Scene change clears any stale typing flag.
      if (s.is_typing_scene_id && s.is_typing_scene_id !== sceneId) {
        s.is_typing_scene_id = null;
      }
      scheduleTrack();
    },
    [scheduleTrack],
  );

  const pingTyping = useCallback(
    (sceneId: string | null) => {
      const s = stateRef.current;
      if (!s) return;

      // Only broadcast on the OFF→ON transition, and only after a minimum
      // quiet window since the last OFF. All subsequent keystrokes while
      // "typing" just extend the local clear timer — zero network traffic.
      const now = Date.now();
      const wasTyping = s.is_typing_scene_id === sceneId && sceneId !== null;
      if (!wasTyping) {
        const quietFor = now - lastTypingOffAt.current;
        if (lastTypingOffAt.current === 0 || quietFor >= TYPING_MIN_OFF_MS) {
          s.is_typing_scene_id = sceneId;
          scheduleTrack();
        } else {
          // Still in cooldown; skip the transition entirely to prevent flicker.
          return;
        }
      }

      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
      typingClearTimer.current = setTimeout(() => {
        const cur = stateRef.current;
        if (!cur) return;
        if (cur.is_typing_scene_id === null) return;
        cur.is_typing_scene_id = null;
        lastTypingOffAt.current = Date.now();
        scheduleTrack();
      }, TYPING_CLEAR_MS);
    },
    [scheduleTrack],
  );

  const setActiveBlock = useCallback(
    (blockId: string | null) => {
      const s = stateRef.current;
      if (!s) return;
      if (s.active_block_id === blockId) return;
      s.active_block_id = blockId;
      scheduleTrack();
    },
    [scheduleTrack],
  );

  return useMemo(
    () => ({ peers, connected, setActiveArea, setActiveScene, pingTyping, setActiveBlock }),
    [peers, connected, setActiveArea, setActiveScene, pingTyping, setActiveBlock],
  );
}
