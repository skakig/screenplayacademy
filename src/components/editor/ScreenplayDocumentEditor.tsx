import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText, Wand2, Info, X } from "lucide-react";
import { useScreenplayDocument, type SaveStatus, type LocalBlock } from "./useScreenplayDocument";
import { ScreenplayLine, type AutoFormatEvent, type AnnotationMode } from "./ScreenplayLine";
import { nextBlockTypeAfter } from "./screenplayKeymap";
import type { CharacterHit } from "@/components/editor/CharacterAutocomplete";
import type { PersistenceAdapter } from "./screenplayPersistence";
import { BLOCK_LABEL } from "@/lib/editor/autoFormat";
import { t } from "@/lib/i18n/t";
import { useActiveLineViewport, type ActiveLineViewportMode } from "./useActiveLineViewport";
import { formatPastedScript, type ParsedBlock } from "./screenplayAutoFormat";
import { PasteFormatPreviewDialog } from "./PasteFormatPreviewDialog";
import { SceneHeadingChips } from "./SceneHeadingChips";
import { RecentCharacterChips } from "./RecentCharacterChips";
import { markFixRejected } from "./formatOverrideMemory";


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
  /** Focus-zone mode for the active-line viewport scroller. */
  viewportMode?: ActiveLineViewportMode;
  /** Project dictionary terms (lowercased) — protected from auto-correction. */
  projectDictionary?: Set<string>;
  /** Rejected-fix overrides (lowercased) — never reapply these. */
  rejectedFixes?: Set<string>;
  /** Add a new term to the project dictionary. Wires the "Add" chip. */
  onAddDictionaryTerm?: (term: string, category?: "character" | "location" | "custom") => void;
  /** Persist a rejected structural suggestion to project-level memory. */
  onRejectFormatSuggestion?: (original: string, suggestedType: string) => void;
  /** Screenplay language (default for every block in the project). */
  screenplayLanguage?: import("@/lib/language/types").LanguageCode;
  /** Languages the writer reads/writes. Drives cognate / false-friend logic. */
  knownLanguages?: import("@/lib/language/types").LanguageCode[];
  /** In-page annotation visibility. Focus/Basic pass "silent"; Advanced passes "quiet". */
  annotationMode?: AnnotationMode;
  /**
   * Chrome-level surface control, distinct from annotationMode.
   * - "focus":   hide chip strips AND the auto-format pill (sacred page).
   * - "basic":   show chip strips and the auto-format pill (teaching mode).
   * - "advanced":show chip strips and the auto-format pill (default).
   */
  chromeMode?: "focus" | "basic" | "advanced";
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
      viewportMode = "normal",
      projectDictionary,
      rejectedFixes,
      onAddDictionaryTerm,
      onRejectFormatSuggestion,
      screenplayLanguage,
      knownLanguages,
      annotationMode = "quiet",
      chromeMode = "advanced",
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

    const showChips = chromeMode !== "focus";
    const showFormatPill = chromeMode !== "focus";
    const [suppressToken, setSuppressToken] = useState(0);
    const [suppressFor, setSuppressFor] = useState<{ blockId: string; original: string } | null>(null);

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

    // Build a language-intelligence context once per relevant input change.
    // Character names from the project sidebar, project dictionary terms,
    // and any rejected fixes (sticky undo) are all lowercased sets.
    const characterNameSet = useMemo(() => {
      const s = new Set<string>();
      for (const c of characters) {
        if (c?.name) s.add(c.name.toLowerCase());
      }
      return s;
    }, [characters]);

    const languageContext = useMemo(
      () => ({
        blockType: "action", // overridden per-line by ScreenplayLine
        characterNames: characterNameSet,
        projectDictionary: projectDictionary ?? new Set<string>(),
        rejectedFixes: rejectedFixes ?? new Set<string>(),
        screenplayLanguage,
        knownLanguages,
      }),
      [characterNameSet, projectDictionary, rejectedFixes, screenplayLanguage, knownLanguages],
    );



    // Dedicated editor scroll container — owns screenplay scrolling so the
    // window doesn't have to. See docs/EDITOR_FOCUS_AND_VIEWPORT.md.
    const scrollRef = useRef<HTMLDivElement>(null);
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia?.("(max-width: 640px)").matches;

    const getActiveLineEl = useCallback(() => {
      const id = doc.activeBlockId;
      if (!id || !scrollRef.current) return null;
      return scrollRef.current.querySelector<HTMLElement>(
        `[data-local-id="${CSS.escape(id)}"]`,
      );
    }, [doc.activeBlockId]);

    const { scheduleScroll } = useActiveLineViewport({
      containerRef: scrollRef,
      getActiveLineEl,
      mode: viewportMode,
      isMobile,
    });

    // Re-center on active-line change and on block count change (Enter inserts).
    useEffect(() => {
      scheduleScroll("enter");
    }, [doc.activeBlockId, doc.localBlocks.length, scheduleScroll]);

    // ---------- paste-batch format preview ----------
    const [pastePreview, setPastePreview] = useState<{
      blocks: ParsedBlock[];
      anchorLocalId: string | null;
      rawText: string;
    } | null>(null);

    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const ta = target.closest?.("textarea[data-block-editor]") as HTMLTextAreaElement | null;
        if (!ta) return;
        const text = e.clipboardData.getData("text/plain");
        if (!text) return;
        const isLarge = text.length > 120 || /\n.*\S.*\n/.test(text);
        if (!isLarge) return; // small paste — let textarea handle it
        // Only intercept when target is empty or caret is at end of an empty block;
        // otherwise the writer is splicing into existing prose and we shouldn't surprise them.
        const active = doc.localBlocks.find((b) => b.id === doc.activeBlockId);
        if (!active) return;
        e.preventDefault();
        const parsed = formatPastedScript(text, {
          currentBlockType: "action",
          prevBlockType: active.block_type,
          characterNames: characterNameSet,
        });
        if (parsed.length === 0) return;
        setPastePreview({
          blocks: parsed,
          anchorLocalId: active.id,
          rawText: text,
        });
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [doc.activeBlockId, doc.localBlocks],
    );

    const insertParsed = useCallback(
      (accepted: ParsedBlock[]) => {
        if (!pastePreview || accepted.length === 0) {
          setPastePreview(null);
          return;
        }
        const anchorId = pastePreview.anchorLocalId;
        const anchor = doc.localBlocks.find((b) => b.id === anchorId);
        const defs = accepted.map((b) => ({ block_type: b.block_type, content: b.content }));
        // If the anchor block is empty, reuse it for the first inserted block.
        if (anchor && anchor.content === "" && defs.length > 0) {
          doc.changeBlockType(anchor.id, defs[0].block_type);
          doc.updateBlockContent(anchor.id, defs[0].content);
          if (defs.length > 1) doc.insertBlocksAfter(anchor.id, defs.slice(1));
        } else {
          doc.insertBlocksAfter(anchorId, defs);
        }
        setPastePreview(null);
      },
      [pastePreview, doc],
    );

    const insertRaw = useCallback(() => {
      if (!pastePreview) return;
      const anchor = doc.localBlocks.find((b) => b.id === pastePreview.anchorLocalId);
      if (anchor) {
        const combined = anchor.content
          ? `${anchor.content}\n${pastePreview.rawText}`
          : pastePreview.rawText;
        doc.updateBlockContent(anchor.id, combined);
      }
      setPastePreview(null);
    }, [pastePreview, doc]);


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
        jumpToServer: (serverId) => {
          doc.jumpToServer(serverId);
          scheduleScroll("jump", { force: true });
        },
        getBlocks: () => doc.localBlocks,
      }),
      [doc, scheduleScroll],
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
        ref={scrollRef}
        onPaste={handlePaste}
        className="screenplay-scroll relative h-full overflow-y-auto overscroll-contain"
      >
        <div
          className="screenplay screenplay-paper max-w-[760px] mx-auto px-10 lg:px-16 py-12 lg:py-16 cursor-text relative"
          onClick={handlePaperClick}
        >
        {showFormatPill && lastFormat && (
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
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!lastFormat) return;
                  doc.updateBlockContent(lastFormat.blockId, lastFormat.original);
                  if (lastFormat.typeChanged) {
                    doc.changeBlockType(lastFormat.blockId, lastFormat.previousBlockType);
                  }
                  markFixRejected(projectId, lastFormat.original);
                  setSuppressFor({ blockId: lastFormat.blockId, original: lastFormat.original });
                  setSuppressToken((n) => n + 1);
                  setLastFormat(null);
                  setWhyOpen(false);
                }}
                className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/15 transition"
                aria-label={t("editor.autoFormat.undo")}
                title={t("editor.autoFormat.undo")}
              >
                {t("editor.autoFormat.undo")}
              </button>
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
              const isActive = b.id === doc.activeBlockId;
              const suppressOriginalForBlock =
                suppressFor && suppressFor.blockId === b.id ? suppressFor.original : null;
              return (
                <div key={b.id} data-local-id={b.id}>
                  {isNewScene && (
                    <div className="my-6 flex items-center gap-3 font-sans" aria-hidden="true">
                      <div className="h-px flex-1 bg-border/60" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-mono">
                        Scene
                      </span>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                  )}
                  {/* Mobile: chip strip renders ABOVE the line (keyboard sits below). */}
                  {showChips && isActive && isMobile && b.block_type === "scene_heading" && (
                    <SceneHeadingChips
                      value={b.content}
                      onApply={(next) => doc.updateBlockContent(b.id, next)}
                    />
                  )}
                  {showChips && isActive && isMobile && b.block_type === "character" && b.content === "" && (
                    <RecentCharacterChips
                      blocks={doc.localBlocks}
                      activeId={doc.activeBlockId}
                      onPick={(name) => {
                        doc.updateBlockContent(b.id, name);
                        const nextType = nextBlockTypeAfter("character", prev?.block_type);
                        doc.insertBlockAfter(b.id, nextType);
                      }}
                    />
                  )}
                  <ScreenplayLine
                    block={b}
                    isActive={isActive}
                    isFirstEmpty={i === 0 && doc.localBlocks.length === 1 && b.content === "" && b.block_type === "scene_heading"}
                    characters={characters}
                    prevBlockType={prev?.block_type}
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
                    languageContext={{ ...languageContext, blockType: b.block_type }}
                    onAddDictionaryTerm={onAddDictionaryTerm}
                    onRejectFormatSuggestion={onRejectFormatSuggestion}
                    annotationMode={annotationMode}
                    suppressAutoFormatOriginal={suppressOriginalForBlock}
                    suppressAutoFormatToken={suppressToken}
                  />
                  {/* Desktop/tablet: chip strip renders BELOW the line. */}
                  {showChips && isActive && !isMobile && b.block_type === "scene_heading" && (
                    <SceneHeadingChips
                      value={b.content}
                      onApply={(next) => doc.updateBlockContent(b.id, next)}
                    />
                  )}
                  {showChips && isActive && !isMobile && b.block_type === "character" && b.content === "" && (
                    <RecentCharacterChips
                      blocks={doc.localBlocks}
                      activeId={doc.activeBlockId}
                      onPick={(name) => {
                        doc.updateBlockContent(b.id, name);
                        const nextType = nextBlockTypeAfter("character", prev?.block_type);
                        doc.insertBlockAfter(b.id, nextType);
                      }}
                    />
                  )}
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
        <PasteFormatPreviewDialog
          open={!!pastePreview}
          blocks={pastePreview?.blocks ?? []}
          onCancel={() => setPastePreview(null)}
          onInsertFormatted={insertParsed}
          onInsertRaw={insertRaw}
        />
      </div>
    );
  },
);
