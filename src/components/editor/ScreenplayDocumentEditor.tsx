import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText, Wand2 } from "lucide-react";
import { useScreenplayDocument, type SaveStatus } from "./useScreenplayDocument";
import { ScreenplayLine } from "./ScreenplayLine";
import { nextBlockTypeAfter } from "./screenplayKeymap";
import type { CharacterHit } from "@/components/editor/CharacterAutocomplete";
import type { PersistenceAdapter } from "./screenplayPersistence";


export type ActiveBlockMeta = {
  localId: string;
  serverId?: string;
  type: string;
  orderIndex: number;
} | null;

export type ScreenplayEditorHandle = {
  changeActiveType: (type: string) => void;
  insertAfterActive: (type?: string) => void;
  insertAtEnd: (type: string) => void;
  jumpToServer: (serverId: string) => void;
};

type Props = {
  projectId: string;
  initialBlocks: any[];
  blocksLoading?: boolean;
  characters?: CharacterHit[];
  onCreateCharacter?: (name: string) => Promise<any>;
  onActiveBlockChange?: (meta: ActiveBlockMeta) => void;
  onSaveStatus?: (s: SaveStatus) => void;
  onLastSaved?: (ts: number) => void;
  onBlockCreated?: (block_type: string) => void;
  onOpenStoryBuilder?: () => void;
  onDraftWithAi?: () => void;
  onInsertTemplate?: () => void;
  primaryBusy?: boolean;
  /**
   * Optional persistence adapter. When omitted, the hook falls back to its
   * built-in Supabase path (production editor behavior). /editor-lab passes
   * NullPersistenceAdapter to run fully local.
   */
  persistence?: PersistenceAdapter;
};

export const ScreenplayDocumentEditor = forwardRef<ScreenplayEditorHandle, Props>(
  function ScreenplayDocumentEditor(
    {
      projectId,
      initialBlocks,
      blocksLoading,
      characters = [],
      onCreateCharacter,
      onActiveBlockChange,
      onSaveStatus,
      onLastSaved,
      onBlockCreated,
      onOpenStoryBuilder,
      onDraftWithAi,
      onInsertTemplate,
      primaryBusy,
      persistence,
    },
    ref,
  ) {
    const doc = useScreenplayDocument({
      projectId,
      initialBlocks,
      blocksLoading,
      onSaveStatus,
      onLastSaved,
      onBlockCreated,
      persistence,
    });

    // bubble active block info up (debounced by key string to avoid spam)
    const lastSent = useRef<string>("");
    useEffect(() => {
      const b = doc.localBlocks.find((x) => x.id === doc.activeBlockId);
      const key = b ? `${b.id}|${b.serverId ?? ""}|${b.block_type}|${b.order_index}` : "";
      if (key === lastSent.current) return;
      lastSent.current = key;
      onActiveBlockChange?.(
        b ? { localId: b.id, serverId: b.serverId, type: b.block_type, orderIndex: b.order_index } : null,
      );
    }, [doc.activeBlockId, doc.localBlocks, onActiveBlockChange]);

    useImperativeHandle(
      ref,
      () => ({
        changeActiveType: (t) => {
          if (doc.activeBlockId) doc.changeBlockType(doc.activeBlockId, t);
        },
        insertAfterActive: (type) => {
          const cur = doc.localBlocks;
          const active = cur.find((b) => b.id === doc.activeBlockId);
          const t = type ?? (active ? nextBlockTypeAfter(active.block_type) : "scene_heading");
          if (active) doc.insertBlockAfter(active.id, t);
          else doc.insertAtEnd(t);
        },
        insertAtEnd: (t) => {
          doc.insertAtEnd(t);
        },
        jumpToServer: (serverId) => doc.jumpToServer(serverId),
      }),
      [doc],
    );

    const handlePaperMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("textarea, button, input, [role='menu'], [data-block-toolbar]")) return;
      const all = e.currentTarget.querySelectorAll<HTMLTextAreaElement>("textarea[data-block-editor]");
      if (all.length === 0) return;
      const y = e.clientY;
      const last = all[all.length - 1];
      const lastRect = last.getBoundingClientRect();
      if (y > lastRect.bottom + 8) {
        e.preventDefault();
        const cur = doc.localBlocks;
        if (cur.length === 0) doc.insertAtEnd("scene_heading");
        else {
          const lb = cur[cur.length - 1];
          doc.insertBlockAfter(lb.id, nextBlockTypeAfter(lb.block_type));
        }
        return;
      }
      e.preventDefault();
      let best: HTMLTextAreaElement = all[0];
      let bestDist = Infinity;
      all.forEach((t) => {
        const r = t.getBoundingClientRect();
        const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
        if (d < bestDist) {
          bestDist = d;
          best = t;
        }
      });
      best.focus();
      try {
        const len = best.value.length;
        best.setSelectionRange(len, len);
      } catch {}
    };

    const onlyEmptySeed =
      doc.localBlocks.length <= 1 && (doc.localBlocks[0]?.content ?? "") === "";

    return (
      <div
        className="screenplay screenplay-paper max-w-[760px] mx-auto px-10 lg:px-16 py-12 lg:py-16 cursor-text"
        onMouseDown={handlePaperMouseDown}
      >
        {blocksLoading && doc.localBlocks.length === 0 ? (
          <div className="space-y-3 py-8 font-sans">
            <div className="h-5 w-2/3 bg-muted/50 rounded animate-pulse" />
            <div className="h-4 w-full bg-muted/40 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-muted/40 rounded animate-pulse" />
          </div>
        ) : (
          <>
            {doc.localBlocks.map((b, i) => {
              const prev = i > 0 ? doc.localBlocks[i - 1] : undefined;
              const isNewScene = b.block_type === "scene_heading" && i > 0;
              return (
                <div key={b.id}>
                  {isNewScene && (
                    <div className="my-6 flex items-center gap-3 font-sans" aria-hidden="true">
                      <div className="h-px flex-1 bg-border/60" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-mono">
                        Scene
                      </span>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                  )}
                  <ScreenplayLine
                    block={b}
                    isActive={b.id === doc.activeBlockId}
                    characters={characters}
                    onCreateCharacter={
                      onCreateCharacter ?? (async () => undefined)
                    }
                    onFocus={() => doc.setActiveBlockId(b.id)}
                    onContentChange={(c) => doc.updateBlockContent(b.id, c)}
                    onChangeType={(t) => doc.changeBlockType(b.id, t)}
                    onUpdateMetadata={(m) => doc.updateBlockMetadata(b.id, m)}
                    onEnter={() => {
                      const nextType = nextBlockTypeAfter(b.block_type, prev?.block_type);
                      doc.insertBlockAfter(b.id, nextType);
                    }}
                    onDeleteEmpty={() => doc.deleteBlock(b.id)}
                    onSlashInsert={(type) => doc.insertBlockAfter(b.id, type)}
                  />
                </div>
              );
            })}

            {onlyEmptySeed && (onOpenStoryBuilder || onDraftWithAi || onInsertTemplate) && (
              <div className="mt-10 pt-6 border-t border-border/40 font-sans">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground text-center mb-3">
                  Or start with a helper
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {onOpenStoryBuilder && (
                    <Button variant="outline" size="sm" onClick={onOpenStoryBuilder} disabled={primaryBusy}>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Story Builder
                    </Button>
                  )}
                  {onDraftWithAi && (
                    <Button variant="outline" size="sm" onClick={onDraftWithAi} disabled={primaryBusy}>
                      <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Generate opening scene
                    </Button>
                  )}
                  {onInsertTemplate && (
                    <Button variant="outline" size="sm" onClick={onInsertTemplate} disabled={primaryBusy}>
                      <FileText className="h-3.5 w-3.5 mr-1.5" /> Insert opening template
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  },
);
