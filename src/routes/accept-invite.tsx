import { useEffect, useMemo, useState } from "react";
import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n/t";

const searchSchema = z.object({
  token: z.string().min(1).optional(),
});

type AcceptStatus =
  | "checking"
  | "accepted"
  | "invalid"
  | "expired"
  | "revoked"
  | "accepted_already"
  | "email_mismatch"
  | "missing_token"
  | "needs_signin"
  | "unknown";

interface RpcRow {
  project_id: string | null;
  status: string | null;
}

export const Route = createFileRoute("/accept-invite")({
  // Public route: unauthenticated visitors must be able to land here from an
  // email link. We handle auth ourselves and bounce to /auth?next=… when
  // needed so the token survives the sign-in round-trip.
  ssr: false,
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [{ title: "Accept invite — SceneSmith Studio" }],
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = useSearch({ from: "/accept-invite" });
  const navigate = useNavigate();
  const [status, setStatus] = useState<AcceptStatus>("checking");
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!token) {
        if (!cancelled) setStatus("missing_token");
        return;
      }

      // Require an authenticated session before calling the RPC — otherwise
      // it returns { status: "unauthenticated" } and the user sees a generic
      // error instead of being sent to sign in.
      const { data: userData } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!userData.user) {
        setStatus("needs_signin");
        return;
      }

      try {
        const { data, error } = await supabase.rpc(
          "accept_project_invite",
          { _token: token },
        );
        if (cancelled) return;
        if (error) {
          setStatus("unknown");
          return;
        }
        const row: RpcRow | null = Array.isArray(data)
          ? ((data[0] as RpcRow) ?? null)
          : ((data as RpcRow) ?? null);
        const rpcStatus = row?.status ?? "unknown";
        setProjectId(row?.project_id ?? null);
        setStatus(mapRpcStatus(rpcStatus));
      } catch {
        if (!cancelled) setStatus("unknown");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Bounce to /auth with a next= that returns here with the token intact.
  useEffect(() => {
    if (status !== "needs_signin") return;
    const back = `/accept-invite${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    void navigate({ to: "/auth", search: { next: back } });
  }, [status, token, navigate]);

  // Auto-redirect on success.
  useEffect(() => {
    if (status === "accepted" && projectId) {
      const id = window.setTimeout(() => {
        void navigate({
          to: "/writers-room/$projectId",
          params: { projectId },
        });
      }, 800);
      return () => window.clearTimeout(id);
    }
  }, [status, projectId, navigate]);

  return (
    <AppShell>
      <div className="max-w-md mx-auto px-4 py-16">
        <Card className="p-8 bg-card/60 text-center space-y-4">
          <Content
            status={status}
            projectId={projectId}
            onSignOut={async () => {
              await supabase.auth.signOut();
              await navigate({ to: "/auth" });
            }}
            onOpenRoom={() => {
              if (projectId)
                void navigate({
                  to: "/writers-room/$projectId",
                  params: { projectId },
                });
            }}
          />
        </Card>
      </div>
    </AppShell>
  );
}

interface ContentProps {
  status: AcceptStatus;
  projectId: string | null;
  onSignOut: () => void;
  onOpenRoom: () => void;
}

function Content({ status, projectId, onSignOut, onOpenRoom }: ContentProps) {
  const view = useMemo(() => mapStatusToView(status), [status]);
  return (
    <>
      {status === "checking" || status === "needs_signin" ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {status === "needs_signin"
              ? t("collab.acceptInvite.needsSignIn")
              : t("collab.acceptInvite.checking")}
          </p>
        </div>
      ) : (
        <>
          <h1 className="font-display text-2xl font-semibold">{view.title}</h1>
          <p className="text-sm text-muted-foreground">{view.body}</p>
          <div className="flex flex-col gap-2 pt-2">
            {(status === "accepted" || status === "accepted_already") &&
              projectId && (
                <Button onClick={onOpenRoom}>
                  {t("collab.acceptInvite.openRoom")}
                </Button>
              )}
            {status === "email_mismatch" && (
              <Button variant="secondary" onClick={onSignOut}>
                {t("collab.acceptInvite.signOut")}
              </Button>
            )}
            <Button asChild variant="ghost">
              <a href="/dashboard">
                {t("collab.acceptInvite.backToDashboard")}
              </a>
            </Button>
          </div>
        </>
      )}
    </>
  );
}

function mapRpcStatus(s: string): AcceptStatus {
  switch (s) {
    case "accepted":
      return "accepted";
    case "invalid":
      return "invalid";
    case "expired":
      return "expired";
    case "revoked":
      return "revoked";
    case "accepted_already":
    case "already_accepted":
      return "accepted_already";
    case "email_mismatch":
      return "email_mismatch";
    case "unauthenticated":
      return "needs_signin";
    default:
      return "accepted_already";
  }
}

function mapStatusToView(status: AcceptStatus): {
  title: string;
  body: string;
} {
  switch (status) {
    case "accepted":
      return {
        title: t("collab.acceptInvite.acceptedTitle"),
        body: t("collab.acceptInvite.acceptedBody"),
      };
    case "accepted_already":
      return {
        title: t("collab.acceptInvite.acceptedAlreadyTitle"),
        body: t("collab.acceptInvite.acceptedAlreadyBody"),
      };
    case "expired":
      return {
        title: t("collab.acceptInvite.expiredTitle"),
        body: t("collab.acceptInvite.expiredBody"),
      };
    case "revoked":
      return {
        title: t("collab.acceptInvite.revokedTitle"),
        body: t("collab.acceptInvite.revokedBody"),
      };
    case "email_mismatch":
      return {
        title: t("collab.acceptInvite.emailMismatchTitle"),
        body: t("collab.acceptInvite.emailMismatchBody"),
      };
    case "invalid":
      return {
        title: t("collab.acceptInvite.invalidTitle"),
        body: t("collab.acceptInvite.invalidBody"),
      };
    case "missing_token":
      return {
        title: t("collab.acceptInvite.missingTokenTitle"),
        body: t("collab.acceptInvite.missingTokenBody"),
      };
    case "checking":
    case "needs_signin":
    case "unknown":
    default:
      return {
        title: t("collab.acceptInvite.unknownTitle"),
        body: t("collab.acceptInvite.unknownBody"),
      };
  }
}
