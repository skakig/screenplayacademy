import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText, Wand2, Info, X } from "lucide-react";
import { useScreenplayDocument, type SaveStatus, type LocalBlock } from "./useScreenplayDocument";
import { ScreenplayLine, type AutoFormatEvent } from "./ScreenplayLine";
import { nextBlockTypeAfter } from "./screenplayKeymap";
import type { CharacterHit } from "@/components/editor/CharacterAutocomplete";
import type { PersistenceAdapter } from "./screenplayPersistence";
import { BLOCK_LABEL } from "@/lib/editor/autoFormat";
import { t } from "@/lib/i18n/t";


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
  getBlocks: () => LocalBlock[];
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
  onDraftRestored?: (count: number) => void;
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
      onDraftRestored,
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
      onDraftRestored,
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

    // Auto-format indicator state. Shows a small pill describing the most
    // recent format event for ~5s, with a "why" tooltip for beginners.
    const [lastFormat, setLastFormat] = useState<AutoFormatEvent | null>(null);
    const [whyOpen, setWhyOpen] = useState(false);
    useEffect(() => {
      if (!lastFormat) return;
      const id = setTimeout(() => setLastFormat(null), 5000);
      return () => clearTimeout(id);
    }, [lastFormat]);

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
        getBlocks: () => doc.localBlocks,
      }),
      [doc],
    );

    // Use click (not mousedown) so iOS Safari completes the tap gesture before
    // we programmatically focus a textarea. Avoid preventDefault — it breaks
    // the soft-keyboard opening on mobile.
    const handlePaperClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("textarea, button, input, [role='menu'], [data-block-toolbar]")) return;
      const all = e.currentTarget.querySelectorAll<HTMLTextAreaElement>("textarea[data-block-editor]");
      if (all.length === 0) return;
      const y = e.clientY;
      const last = all[all.length - 1];
      const lastRect = last.getBoundingClientRect();
      if (y > lastRect.bottom + 8) {
        const cur = doc.localBlocks;
        if (cur.length === 0) {
          doc.insertAtEnd("scene_heading");
        } else {
          const lb = cur[cur.length - 1];
          doc.insertBlockAfter(lb.id, nextBlockTypeAfter(lb.block_type));
        }
        // Focus on next frame — the new textarea mounts then.
        requestAnimationFrame(() => {
          const fresh = e.currentTarget?.querySelectorAll<HTMLTextAreaElement>(
            "textarea[data-block-editor]",
          );
          fresh?.[fresh.length - 1]?.focus();
        });
        return;
      }
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
        className="screenplay screenplay-paper max-w-[760px] mx-auto px-10 lg:px-16 py-12 lg:py-16 cursor-text relative"
        onClick={handlePaperClick}
      >
        {lastFormat && (
          <div
            className="sticky top-3 z-20 mx-auto mb-3 w-fit max-w-full font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur px-3 py-1.5 shadow-sm text-xs text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
              <span className="truncate max-w-[320px]">
                {lastFormat.typeChanged
                  ? t("editor.autoFormat.indicator", {
                      result: BLOCK_LABEL[lastFormat.blockType] ?? lastFormat.blockType,
                    })
                  : t("editor.autoFormat.indicatorGeneric")}
              </span>
              <button
                type="button"
                onClick={() => setWhyOpen((v) => !v)}
                className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-background/60 transition"
                aria-label={t("editor.autoFormat.whyTitle")}
                title={t("editor.autoFormat.whyTitle")}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { setLastFormat(null); setWhyOpen(false); }}
                className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-background/60 transition"
                aria-label={t("editor.autoFormat.dismiss")}
                title={t("editor.autoFormat.dismiss")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {whyOpen && (
              <div className="mt-2 mx-auto max-w-[420px] rounded-lg border border-border/60 bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">
                <div className="font-semibold text-foreground mb-1">
                  {t("editor.autoFormat.whyTitle")}
                </div>
                <p className="leading-relaxed">{t("editor.autoFormat.whyBody")}</p>
              </div>
            )}
          </div>
        )}
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
                    isFirstEmpty={i === 0 && doc.localBlocks.length === 1 && b.content === "" && b.block_type === "scene_heading"}
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
                    onAutoFormatApplied={(e) => setLastFormat(e)}
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
