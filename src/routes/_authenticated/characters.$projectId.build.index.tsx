import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { upsertCharacter } from "@/lib/characters.functions";
import { t } from "@/lib/i18n/t";

export const Route = createFileRoute("/_authenticated/characters/$projectId/build/")({
  head: () => ({ meta: [{ title: t("characters.builder.resolver.headTitle") }] }),
  component: CharacterBuildResolver,
});

function CharacterBuildResolver() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const callUpsert = useServerFn(upsertCharacter);
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const { data: existing, error: listError } = await supabase
          .from("characters")
          .select("id")
          .eq("project_id", projectId)
          .is("quarantined_at", null)
          .order("created_at", { ascending: true })
          .limit(1);

        if (listError) throw listError;

        const existingId = existing?.[0]?.id;
        if (existingId) {
          await navigate({
            to: "/characters/$projectId/build/$characterId",
            params: { projectId, characterId: existingId },
            replace: true,
          });
          return;
        }

        const row: any = await callUpsert({
          data: { project_id: projectId, patch: { name: t("characters.builder.newCharacterName") } },
        });

        if (!row?.id) throw new Error(t("characters.builder.resolver.createError"));
        toast.success(t("characters.builder.resolver.createdToast"));
        await navigate({
          to: "/characters/$projectId/build/$characterId",
          params: { projectId, characterId: row.id },
          replace: true,
        });
      } catch (e: any) {
        started.current = false;
        setError(e?.message ?? t("characters.builder.resolver.error"));
      }
    })();
  }, [callUpsert, navigate, projectId]);

  if (error) {
    return (
      <div className="min-h-dvh bg-background text-foreground grid place-items-center px-6">
        <div className="max-w-md text-center space-y-5">
          <div className="mx-auto h-12 w-12 rounded-full border border-destructive/40 bg-destructive/10 grid place-items-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold">{t("characters.builder.resolver.errorTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/characters/$projectId" params={{ projectId }}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("characters.builder.returnToCharacters")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground grid place-items-center px-6">
      <div className="text-center space-y-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary mx-auto" />
        <h1 className="font-display text-2xl font-semibold">{t("characters.builder.resolver.loadingTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("characters.builder.resolver.loadingBody")}</p>
      </div>
    </div>
  );
}