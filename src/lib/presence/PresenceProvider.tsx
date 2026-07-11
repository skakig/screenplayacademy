import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { fetchProjectRole, wrKeys } from "@/lib/collab";
import type { ProjectRole } from "@/components/writers-room/roles";

import { usePresenceChannel } from "./usePresenceChannel";
import type { PresenceArea, PresencePeer } from "./types";

interface PresenceContextValue {
  peers: PresencePeer[];
  connected: boolean;
  setActiveArea: (area: PresenceArea) => void;
  setActiveScene: (id: string | null, label: string | null) => void;
  setActiveBlock: (id: string | null) => void;
  pingTyping: (sceneId: string | null) => void;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

interface SelfIdentity {
  user_id: string;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

interface Props {
  projectId: string;
  /**
   * Optional preloaded role. If omitted, the provider fetches it itself
   * (and degrades silently for non-members).
   */
  role?: ProjectRole | null;
  children: ReactNode;
}

/**
 * Project-scoped presence boundary. Subscribes ONLY after both:
 *   - the current user is loaded, and
 *   - the user has an active project role (owner or active member).
 *
 * Non-members never get a tracked payload. Editor state is untouched —
 * this is a sibling React tree.
 */
export function PresenceProvider({ projectId, role: roleProp, children }: Props) {
  const [self, setSelf] = useState<SelfIdentity | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      const fullName =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && (meta.name as string)) ||
        null;
      const avatarUrl =
        (typeof meta.avatar_url === "string" && meta.avatar_url) ||
        (typeof meta.picture === "string" && (meta.picture as string)) ||
        null;

      // Best-effort profile lookup; ignore failure.
      let profileName: string | null = null;
      let profileAvatar: string | null = null;
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", data.user.id)
          .maybeSingle();
        if (prof) {
          profileName = prof.full_name ?? null;
          profileAvatar = prof.avatar_url ?? null;
        }
      } catch {
        /* ignore */
      }

      if (cancelled) return;
      setSelf({
        user_id: data.user.id,
        display_name: profileName ?? fullName,
        email: data.user.email ?? null,
        avatar_url: profileAvatar ?? avatarUrl,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { data: fetchedRole } = useQuery({
    queryKey: wrKeys.role(projectId),
    queryFn: () => fetchProjectRole(projectId),
    enabled: roleProp === undefined,
  });

  const role = roleProp !== undefined ? roleProp : (fetchedRole ?? null);

  const presence = usePresenceChannel({ projectId, role, self });

  const value = useMemo<PresenceContextValue>(
    () => ({
      peers: presence.peers,
      connected: presence.connected,
      setActiveArea: presence.setActiveArea,
      setActiveScene: presence.setActiveScene,
      pingTyping: presence.pingTyping,
    }),
    [presence],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

/** Inside a PresenceProvider only. */
export function usePresence(): PresenceContextValue {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error("usePresence() called outside <PresenceProvider>");
  return ctx;
}

/** Safe variant: returns null when no provider is mounted. */
export function useOptionalPresence(): PresenceContextValue | null {
  return useContext(PresenceContext);
}
