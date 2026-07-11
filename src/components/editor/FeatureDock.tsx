import { Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, Headphones, Layers, FileText, GraduationCap, LineChart } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n/t";
import type { I18nKey } from "@/lib/i18n/keys";
import { listProjectCharacters, upsertCharacter } from "@/lib/characters.functions";

type Props = { projectId: string };

type DockItem = {
  to: "/story-arc/$projectId" | "/storyboard/$projectId" | "/tableread/$projectId" | "/pitch/$projectId" | "/academy";
  labelKey: I18nKey;
  descKey: I18nKey;
  Icon: typeof Sparkles;
  tint: string;
};

const ITEMS: DockItem[] = [
  { to: "/story-arc/$projectId", labelKey: "dock.arc.label", descKey: "dock.arc.desc", Icon: LineChart, tint: "from-violet-400/20 to-violet-400/0" },
  { to: "/storyboard/$projectId", labelKey: "dock.storyboard.label", descKey: "dock.storyboard.desc", Icon: Layers, tint: "from-blue-400/20 to-blue-400/0" },
  { to: "/tableread/$projectId", labelKey: "dock.tableread.label", descKey: "dock.tableread.desc", Icon: Headphones, tint: "from-emerald-400/20 to-emerald-400/0" },
  { to: "/pitch/$projectId", labelKey: "dock.pitch.label", descKey: "dock.pitch.desc", Icon: FileText, tint: "from-rose-400/20 to-rose-400/0" },
  { to: "/academy", labelKey: "dock.academy.label", descKey: "dock.academy.desc", Icon: GraduationCap, tint: "from-sky-400/20 to-sky-400/0" },
];

export function FeatureDock({ projectId }: Props) {
  const navigate = useNavigate();
  const listChars = useServerFn(listProjectCharacters);
  const createChar = useServerFn(upsertCharacter);
  const [charLoading, setCharLoading] = useState(false);

  const openCharacterBuilder = async () => {
    if (charLoading) return;
    setCharLoading(true);
    try {
      const rows = (await listChars({ data: { projectId } })) as Array<{ id: string; name?: string | null }>;
      let characterId = rows?.[0]?.id;
      const createdFresh = !characterId;
      if (!characterId) {
        const created = (await createChar({
          data: { project_id: projectId, patch: { name: "New Character" } },
        })) as any;
        characterId = created?.row?.id ?? created?.id;
      }
      if (!characterId) throw new Error("Could not resolve character");
      if (createdFresh) {
        toast.success("First character created", {
          description: "Let's build them together in the guided builder.",
        });
      }
      navigate({
        to: "/characters/$projectId/build/$characterId",
        params: { projectId, characterId },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open character builder");
    } finally {
      setCharLoading(false);
    }
  };


  const cardClass =
    "group relative overflow-hidden rounded-lg border border-border/50 bg-card/50 p-3 hover:border-primary/40 hover:bg-card/80 transition-all text-left";

  return (
    <div className="border-t border-border/40 bg-[var(--surface-canvas)]/80 backdrop-blur font-sans">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Character — goes directly to the guided builder */}
          <button
            type="button"
            onClick={openCharacterBuilder}
            disabled={charLoading}
            aria-busy={charLoading}
            className={`${cardClass} disabled:opacity-60`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-amber-400/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="relative flex items-start gap-2.5">
              <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground truncate">
                  {t("dock.characters.label")}
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                  {t("dock.characters.desc")}
                </p>
              </div>
            </div>
          </button>

          {ITEMS.map((it) => {
            const Icon = it.Icon;
            const params = it.to.includes("$projectId") ? { projectId } : undefined;
            return (
              <Link
                key={it.labelKey}
                to={it.to}
                params={params as any}
                className={cardClass}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${it.tint} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}
                />
                <div className="relative flex items-start gap-2.5">
                  <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground truncate">
                      {t(it.labelKey)}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                      {t(it.descKey)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
