import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, BookOpen, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBibleEntryForCharacter } from "@/lib/importation/character-lookup.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: string | null;
  projectId: string;
  universeId: string;
};

export function CharacterBiblePeek({
  open,
  onOpenChange,
  characterId,
  projectId,
  universeId,
}: Props) {
  const fetchEntry = useServerFn(getBibleEntryForCharacter);
  const { data, isLoading, error } = useQuery({
    queryKey: ["bible-entry", universeId, projectId, characterId],
    queryFn: () =>
      fetchEntry({
        data: {
          project_id: projectId,
          universe_id: universeId,
          character_id: characterId!,
        },
      }),
    enabled: open && Boolean(characterId),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md space-y-4 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            {data?.name ?? "Character"}
          </SheetTitle>
          <SheetDescription>
            Latest resolved identity from the Character Bible.
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading entry…
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load"}
          </p>
        )}

        {!isLoading && !data && (
          <p className="text-sm text-muted-foreground">
            No bible entry yet for this character. Generate a new Character
            Bible version to include them.
          </p>
        )}

        {data && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">v{data.bible_version}</Badge>
              {data.importance && (
                <Badge variant="outline">{data.importance}</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {data.speaking_segments} speaking · {data.mention_segments}{" "}
                mentions
              </span>
            </div>

            {data.aliases.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Also known as: </span>
                {data.aliases.join(", ")}
              </div>
            )}

            {data.first_appearance && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">First appearance: </span>
                {data.first_appearance.heading ?? "—"} (seq{" "}
                {data.first_appearance.sequence})
              </div>
            )}

            {data.top_evidence.length > 0 && (
              <div className="pt-2 border-t border-border/50 space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">
                  Evidence
                </div>
                <ul className="space-y-1">
                  {data.top_evidence.slice(0, 5).map((ev) => (
                    <li
                      key={ev.segment_id + ev.excerpt.slice(0, 20)}
                      className="text-foreground/80 border-l-2 border-primary/30 pl-2"
                    >
                      <span className="italic">"{ev.excerpt}"</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        conf {(ev.confidence * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-3">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link
                  to="/character-bible/$projectId/$universeId"
                  params={{ projectId, universeId }}
                >
                  Open in Character Bible
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
