import { useCallback, useEffect, useMemo, useState } from "react";
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
  ssr: false,
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [{ title: "Accept invite — SceneSmith Studio" }],
  }),
  component: AcceptInvitePage,
});

function buildReturnPath(token: string | undefined): string {
  return `/accept-invite${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

function AcceptInvitePage() {
  const { token } = useSearch({ from: "/accept-invite" });
  const navigate = useNavigate();
  const [status, setStatus] = useState<AcceptStatus>("checking");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const runAccept = useCallback(async () => {
    if (!token) {
      setStatus("missing_token");
      return;
    }
    setStatus("checking");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setStatus("needs_signin");
      return;
    }
    setCurrentEmail(userData.user.email ?? null);
    try {
      const { data, error } = await supabase.rpc("accept_project_invite", {
        _token: token,
      });
      if (error) {
        setStatus("unknown");
        return;
      }
      const row: RpcRow | null = Array.isArray(data)
        ? ((data[0] as RpcRow) ?? null)
        : ((data as RpcRow) ?? null);
      setProjectId(row?.project_id ?? null);
      setStatus(mapRpcStatus(row?.status ?? "unknown"));
    } catch {
      setStatus("unknown");
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    void runAccept().catch(() => {
      if (!cancelled) setStatus("unknown");
    });
    return () => {
      cancelled = true;
    };
  }, [runAccept, attempt]);

  // Bounce to /auth preserving the token so it survives sign-in / signup.
  useEffect(() => {
    if (status !== "needs_signin") return;
    void navigate({
      to: "/auth",
      search: { next: buildReturnPath(token) },
    });
  }, [status, token, navigate]);

  // Auto-open the project after acceptance, or when the user was already a member.
  useEffect(() => {
    if ((status === "accepted" || status === "accepted_already") && projectId) {
      const id = window.setTimeout(() => {
        void navigate({
          to: "/editor/$projectId",
          params: { projectId },
        });
      }, 700);
      return () => window.clearTimeout(id);
    }
  }, [status, projectId, navigate]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Keep the invite token so sign-in returns straight back here.
    void navigate({ to: "/auth", search: { next: buildReturnPath(token) } });
  }, [navigate, token]);

  const handleOpenProject = useCallback(() => {
    if (!projectId) return;
    void navigate({ to: "/editor/$projectId", params: { projectId } });
  }, [navigate, projectId]);

  return (
    <AppShell>
      <div className="max-w-md mx-auto px-4 py-16">
        <Card className="p-8 bg-card/60 text-center space-y-4">
          <Content
            status={status}
            projectId={projectId}
            currentEmail={currentEmail}
            onSignOut={handleSignOut}
            onOpenProject={handleOpenProject}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </Card>
      </div>
    </AppShell>
  );
}

interface ContentProps {
  status: AcceptStatus;
  projectId: string | null;
  currentEmail: string | null;
  onSignOut: () => void;
  onOpenProject: () => void;
  onRetry: () => void;
}

function Content({
  status,
  projectId,
  currentEmail,
  onSignOut,
  onOpenProject,
  onRetry,
}: ContentProps) {
  const view = useMemo(
    () => mapStatusToView(status, currentEmail),
    [status, currentEmail],
  );
  if (status === "checking" || status === "needs_signin") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {status === "needs_signin"
            ? t("collab.acceptInvite.needsSignIn")
            : t("collab.acceptInvite.checking")}
        </p>
      </div>
    );
  }
  return (
    <>
      <h1 className="font-display text-2xl font-semibold">{view.title}</h1>
      <p className="text-sm text-muted-foreground whitespace-pre-line">
        {view.body}
      </p>
      <div className="flex flex-col gap-2 pt-2">
        {(status === "accepted" || status === "accepted_already") &&
          projectId && (
            <Button onClick={onOpenProject}>
              {t("collab.acceptInvite.openRoom")}
            </Button>
          )}
        {status === "email_mismatch" && (
          <Button variant="secondary" onClick={onSignOut}>
            {t("collab.acceptInvite.signOut")}
          </Button>
        )}
        {status === "unknown" && (
          <Button variant="secondary" onClick={onRetry}>
            {t("collab.acceptInvite.tryAgain")}
          </Button>
        )}
        <Button asChild variant="ghost">
          <a href="/dashboard">{t("collab.acceptInvite.backToDashboard")}</a>
        </Button>
      </div>
    </>
  );
}

function mapRpcStatus(s: string): AcceptStatus {
  switch (s) {
    case "accepted":
      return "accepted";
    case "invalid":
    case "not_found":
      return "invalid";
    case "expired":
      return "expired";
    case "revoked":
      return "revoked";
    case "accepted_already":
    case "already_accepted":
    case "already_member":
      return "accepted_already";
    case "email_mismatch":
      return "email_mismatch";
    case "unauthenticated":
      return "needs_signin";
    default:
      return "unknown";
  }
}

function mapStatusToView(
  status: AcceptStatus,
  currentEmail: string | null,
): { title: string; body: string } {
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
        body: t("collab.acceptInvite.emailMismatchBody").replace(
          "{currentEmail}",
          currentEmail ?? "this account",
        ),
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
