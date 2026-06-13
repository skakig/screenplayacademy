import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Copy, Mail } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleSelect } from "./RoleSelect";
import { INVITABLE_ROLES, type ProjectRole } from "./roles";
import { t } from "@/lib/i18n/t";
import {
  buildInviteUrl,
  createInvite,
  wrKeys,
} from "@/lib/collab";

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Enter a valid email address." })
    .max(255),
  role: z.enum(INVITABLE_ROLES as unknown as [string, ...string[]]),
});

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteCollaboratorDialog({
  projectId,
  open,
  onOpenChange,
}: Props) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<ProjectRole, "owner">>("co_writer");
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail("");
    setRole("co_writer");
    setError(null);
    setInviteUrl(null);
    setCopied(false);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = inviteSchema.safeParse({ email, role });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
      }
      return createInvite({
        projectId,
        email: parsed.data.email,
        role: parsed.data.role as Exclude<ProjectRole, "owner">,
      });
    },
    onSuccess: ({ token }) => {
      qc.invalidateQueries({ queryKey: wrKeys.invites(projectId) });
      toast.success(t("collab.invite.success"));
      setInviteUrl(buildInviteUrl(token));
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : t("collab.invite.error");
      setError(msg);
      toast.error(t("collab.invite.error"), { description: msg });
    },
  });

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const copyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success(t("collab.invite.copied"));
    } catch {
      // ignore
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {inviteUrl ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("collab.invite.linkTitle")}</DialogTitle>
              <DialogDescription>
                {t("collab.invite.linkBody")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                readOnly
                value={inviteUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={copyLink}
                aria-label={t("collab.invite.copy")}
              >
                <Copy className="h-4 w-4 mr-1.5" />
                {copied ? t("collab.invite.copied") : t("collab.invite.copy")}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>
                {t("collab.invite.done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              mutation.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> {t("collab.invite.button")}
              </DialogTitle>
              <DialogDescription>
                {t("collab.room.subtitle")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="wr-invite-email">
                  {t("collab.invite.emailLabel")}
                </Label>
                <Input
                  id="wr-invite-email"
                  type="email"
                  autoComplete="off"
                  required
                  maxLength={255}
                  placeholder={t("collab.invite.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wr-invite-role">
                  {t("collab.invite.roleLabel")}
                </Label>
                <RoleSelect
                  id="wr-invite-role"
                  value={role}
                  onChange={(r) =>
                    setRole(r as Exclude<ProjectRole, "owner">)
                  }
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleClose(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "…" : t("collab.invite.send")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
