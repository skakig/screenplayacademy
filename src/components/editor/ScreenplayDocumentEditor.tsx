import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Command, Sparkles, FileText, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { nextBlockTypeAfter, cycleType } from "@/lib/editor/nextBlockType";
import { detectBlockType, BLOCK_LABEL } from "@/lib/editor/autoFormat";
import { CharacterAutocomplete, type CharacterHit } from "@/components/editor/CharacterAutocomplete";
import { SceneBeatPicker } from "@/components/editor/SceneBeatPicker";

export const BLOCK_TYPES = [
  { value: "scene_heading", label: "Scene Heading", shortcut: "/scene", aliases: ["/heading", "/h", "/int", "/ext"] },
  { value: "action", label: "Action", shortcut: "/action", aliases: ["/a", "/desc", "/description"] },
  { value: "character", label: "Character", shortcut: "/character", aliases: ["/char", "/c", "/name"] },
  { value: "dialogue", label: "Dialogue", shortcut: "/dialogue", aliases: ["/dia", "/d", "/line", "/speech"] },
  { value: "parenthetical", label: "Parenthetical", shortcut: "/parenthetical", aliases: ["/parenth", "/p", "/wryly", "/beat"] },
  { value: "transition", label: "Transition", shortcut: "/transition", aliases: ["/trans", "/t", "/cut", "/fade"] },
  { value: "shot", label: "Shot", shortcut: "/shot", aliases: ["/s", "/camera", "/angle"] },
  { value: "note", label: "Note", shortcut: "/note", aliases: ["/n", "/comment", "/reminder"] },
];

type AddBlock = (block_type: string, initialContent?: string) => void;
type InsertAfter = (args: { block_type: string; afterOrder: number; initialContent?: string }) => void;
type SaveBlock = (id: string, patch: { content?: string; block_type?: string; metadata?: Record<string, any> }) => void | Promise<void>;

export function ScreenplayDocumentEditor({
  blocks,
  blocksLoading,
  characters,
  focusBlockId,
  setFocusBlockId,
  activeBlockId,
  setActiveBlockId,
  onAddBlock,
  onInsertAfter,
  onSaveBlock,
  onDeleteBlock,
  onCreateCharacter,
  onDirty,
  onOpenStoryBuilder,
  onDraftWithAi,
  onInsertTemplate,
  primaryBusy,
  isSaving,
}: {
  blocks: any[];
  blocksLoading: boolean;
  characters: CharacterHit[];
  focusBlockId: string | null;
  setFocusBlockId: (id: string | null) => void;
  activeBlockId: string | null;
  setActiveBlockId: (updater: (prev: string | null) => string | null) => void;
  onAddBlock: AddBlock;
  onInsertAfter: InsertAfter;
  onSaveBlock: SaveBlock;
  onDeleteBlock: (id: string) => void;
  onCreateCharacter: (name: string) => Promise<any>;
  onDirty: (blockId: string, content: string) => void;
  onOpenStoryBuilder?: () => void;
  onDraftWithAi?: () => void;
  onInsertTemplate?: () => void;
  primaryBusy?: boolean;
  isSaving?: (id: string) => boolean;
}) {
  const ghostRef = useRef<HTMLTextAreaElement>(null);
  const isEmpty = !blocksLoading && blocks.length === 0;

  // Focus the ghost line automatically when there are no blocks yet, so the
  // writer can type immediately on page load.
  useEffect(() => {
    if (isEmpty && ghostRef.current) {
      ghostRef.current.focus();
    }
  }, [isEmpty]);

  // Ghost line: when the user types into it, seed a real block with that
  // character. We use the beforeinput event so we can capture the typed text,
  // cancel the input on the ghost, and forward it into the new block.
  const handleGhostInsert = useCallback(
    (initialContent: string) => {
      if (blocks.length === 0) {
        onAddBlock("scene_heading", initialContent);
      } else {
        const last = blocks[blocks.length - 1];
        const nextType = nextBlockTypeAfter(last.block_type);
        onInsertAfter({ block_type: nextType, afterOrder: last.order_index, initialContent });
      }
    },
    [blocks, onAddBlock, onInsertAfter],
  );

  const handleGhostBeforeInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const ne = e.nativeEvent as InputEvent;
    // Only consume real character / paste input — let arrow keys etc. pass through.
    if (ne.inputType && ne.inputType.startsWith("insert")) {
      e.preventDefault();
      const data = ne.data ?? "";
      handleGhostInsert(data || "");
    }
  };

  // Click on the paper: clicks below the last line focus the ghost line.
  const handlePaperMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("textarea, button, input, [role='menu'], [data-block-toolbar]")) return;
    e.preventDefault();
    const all = e.currentTarget.querySelectorAll<HTMLTextAreaElement>("textarea[data-block-editor]");
    if (all.length === 0) {
      ghostRef.current?.focus();
      return;
    }
    const y = e.clientY;
    const last = all[all.length - 1];
    const lastRect = last.getBoundingClientRect();
    if (y > lastRect.bottom + 8) {
      ghostRef.current?.focus();
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

  return (
    <div
      className="screenplay screenplay-paper max-w-[760px] mx-auto px-10 lg:px-16 py-12 lg:py-16 cursor-text"
      onMouseDown={handlePaperMouseDown}
    >
      {blocksLoading ? (
        <div className="space-y-3 py-8 font-sans">
          <div className="h-5 w-2/3 bg-muted/50 rounded animate-pulse" />
          <div className="h-4 w-full bg-muted/40 rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-muted/40 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-muted/40 rounded animate-pulse" />
        </div>
      ) : (
        <>
          {isEmpty && (
            <div className="mb-6 text-center font-sans select-none" aria-hidden="true">
              <h2 className="text-xl font-semibold text-foreground/90">Start your screenplay</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Type a scene heading like <span className="font-mono">INT. DESERT — DAY</span>, or just start writing.
              </p>
            </div>
          )}

          {blocks.map((b, i) => {
            const isNewScene = b.block_type === "scene_heading" && i > 0;
            return (
              <div key={b.id} data-block-id={b.id}>
                {isNewScene && (
                  <div className="my-6 flex items-center gap-3 font-sans" aria-hidden="true">
                    <div className="h-px flex-1 bg-border/60" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-mono">
                      Scene
                    </span>
                    <div className="h-px flex-1 bg-border/60" />
                  </div>
                )}
                <BlockEditor
                  block={b}
                  prevBlockType={i > 0 ? blocks[i - 1].block_type : undefined}
                  onSave={(patch) => onSaveBlock(b.id, patch)}
                  onDirty={(content) => onDirty(b.id, content)}
                  onDelete={() => onDeleteBlock(b.id)}
                  onInsertAfter={(block_type, initialContent) =>
                    onInsertAfter({ block_type, afterOrder: b.order_index, initialContent })
                  }
                  focusBlockId={focusBlockId}
                  onFocusDone={() => setFocusBlockId(null)}
                  onActiveChange={(id, active) =>
                    setActiveBlockId((prev) => (active ? id : prev === id ? null : prev))
                  }
                  characters={characters}
                  onCreateCharacter={onCreateCharacter}
                />
              </div>
            );
          })}

          {/* Editable ghost trailing line — a real textarea that creates a new
              block on first keystroke. Not a button. */}
          <div className="mt-2 flex items-center gap-2 group/ghost relative">
            <span
              className="inline-block w-px h-5 bg-primary/70 animate-pulse pointer-events-none"
              aria-hidden="true"
            />
            <textarea
              ref={ghostRef}
              data-ghost-line
              rows={1}
              value=""
              onBeforeInput={handleGhostBeforeInput}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text) {
                  e.preventDefault();
                  handleGhostInsert(text);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleGhostInsert("");
                }
              }}
              onChange={() => {
                /* intentionally no-op — input is consumed by onBeforeInput */
              }}
              placeholder={isEmpty ? "INT. LOCATION — DAY" : "Keep writing…"}
              aria-label={isEmpty ? "Start your screenplay" : "Continue writing"}
              className="flex-1 bg-transparent border-none outline-none resize-none caret-primary placeholder:text-muted-foreground/50 min-h-[1.5em] py-0"
              style={{ fontFamily: "inherit", fontSize: "inherit", color: "inherit" }}
            />
            <span
              className="opacity-40 ml-auto font-mono text-[10px] text-muted-foreground pointer-events-none hidden sm:inline"
              aria-hidden="true"
            >
              Enter · Tab change type · / menu
            </span>
          </div>

          {isEmpty && (onOpenStoryBuilder || onDraftWithAi || onInsertTemplate) && (
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
}

function BlockEditor({
  block,
  prevBlockType,
  onSave,
  onDirty,
  onDelete,
  onInsertAfter,
  focusBlockId,
  onFocusDone,
  onActiveChange,
  characters,
  onCreateCharacter,
}: {
  block: any;
  prevBlockType?: string;
  onSave: (patch: { content?: string; block_type?: string; metadata?: Record<string, any> }) => void | Promise<void>;
  onDirty: (content: string) => void;
  onDelete: () => void;
  onInsertAfter: (block_type: string, initialContent?: string) => void;
  focusBlockId: string | null;
  onFocusDone: () => void;
  onActiveChange?: (id: string, active: boolean) => void;
  characters: CharacterHit[];
  onCreateCharacter: (name: string) => Promise<any>;
}) {
  const [val, setVal] = useState<string>(block.content ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const focusedRef = useRef(false);

  // Server echo handling: never overwrite the field while the writer is in it
  // OR has pending unsaved text. Prevents autosave cache patches from blurring
  // / moving the caret mid-keystroke.
  useEffect(() => {
    if (focusedRef.current) return;
    if (dirtyRef.current) return;
    setVal(block.content ?? "");
  }, [block.content]);

  const scheduleSave = useCallback(
    (next: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        saveTimer.current = null;
        if (next === (block.content ?? "")) {
          dirtyRef.current = false;
          return;
        }
        await onSave({ content: next });
        dirtyRef.current = false;
      }, 600);
    },
    [block.content, onSave],
  );

  const flush = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (val !== (block.content ?? "")) {
      void onSave({ content: val });
      dirtyRef.current = false;
    }
  }, [val, block.content, onSave]);

  useEffect(() => () => { flush(); }, [flush]);

  // auto-resize
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [val]);

  // Focus newly inserted blocks (handles temp-id → real-id swap because the
  // route's mutation onSuccess updates focusBlockId to the real id).
  useEffect(() => {
    if (focusBlockId === block.id && ref.current) {
      ref.current.focus();
      try {
        const len = ref.current.value.length;
        ref.current.setSelectionRange(len, len);
      } catch {}
      onFocusDone();
    }
  }, [focusBlockId, block.id, onFocusDone]);

  const placeholder: Record<string, string> = {
    scene_heading: "INT. LOCATION - DAY",
    action: "Describe what we see...",
    character: "CHARACTER NAME",
    dialogue: "What they say...",
    parenthetical: "(beat)",
    transition: "CUT TO:",
    shot: "CLOSE ON",
    note: "Note to self...",
  };

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashStart, setSlashStart] = useState<number>(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const query =
    slashOpen && slashStart >= 0 ? val.slice(slashStart + 1).toLowerCase() : "";

  const filtered = BLOCK_TYPES.filter(
    (t) =>
      t.label.toLowerCase().includes(query) ||
      t.value.toLowerCase().includes(query) ||
      t.shortcut.toLowerCase().includes(query) ||
      t.aliases.some((a) => a.toLowerCase().includes(query)),
  );

  const closeSlash = useCallback(() => {
    setSlashOpen(false);
    setSlashStart(-1);
    setSelectedIndex(0);
  }, []);

  const executeSlash = useCallback(
    (blockType: string) => {
      const beforeSlash = val.slice(0, slashStart);
      setVal(beforeSlash);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      void onSave({ content: beforeSlash });
      closeSlash();
      onInsertAfter(blockType);
    },
    [val, slashStart, closeSlash, onSave, onInsertAfter],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSlash();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filtered[selectedIndex]) executeSlash(filtered[selectedIndex].value);
        return;
      }
    } else {
      if (e.key === "Tab") {
        e.preventDefault();
        const next = cycleType(block.block_type, e.shiftKey ? -1 : 1);
        void onSave({ block_type: next });
        toast.success(`→ ${BLOCK_LABEL[next] ?? next}`, { duration: 1000 });
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (val !== (block.content ?? "")) {
          if (saveTimer.current) {
            clearTimeout(saveTimer.current);
            saveTimer.current = null;
          }
          void onSave({ content: val });
        }
        const nextType = nextBlockTypeAfter(block.block_type, prevBlockType);
        onInsertAfter(nextType);
        return;
      }
      if (e.key === "Backspace" && val === "") {
        e.preventDefault();
        onDelete();
        return;
      }
    }

    if (e.key === "/" && !slashOpen) {
      const pos = e.currentTarget.selectionStart;
      setSlashOpen(true);
      setSlashStart(pos);
      setSelectedIndex(0);
    }
  };

  const autoFormattedRef = useRef(false);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setVal(newVal);
    dirtyRef.current = true;
    onDirty(newVal);
    scheduleSave(newVal);

    if (!autoFormattedRef.current && newVal.length <= 40) {
      const detected = detectBlockType(newVal);
      if (detected && detected !== block.block_type) {
        autoFormattedRef.current = true;
        void onSave({ block_type: detected });
        toast.success(`Auto-formatted as ${BLOCK_LABEL[detected]}`, { duration: 1400 });
      }
    }

    if (slashOpen) {
      if (slashStart >= newVal.length || newVal[slashStart] !== "/") closeSlash();
    }
  };

  useEffect(() => {
    if (!slashOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeSlash();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [slashOpen, closeSlash]);

  const [isFocused, setIsFocused] = useState(false);
  const QUICK_TYPES = ["scene_heading", "action", "character", "dialogue", "parenthetical"] as const;

  const isCharBlock = block.block_type === "character";
  const isSceneHeading = block.block_type === "scene_heading";
  const showAutocomplete = isCharBlock && isFocused && !slashOpen;
  const beat = (block.metadata as any)?.beat ?? null;

  return (
    <div
      className={`group relative blk-${block.block_type} border-l-2 pl-3 -ml-3 transition-colors ${
        isFocused ? "border-primary bg-primary/[0.04]" : "border-transparent hover:border-border"
      }`}
    >
      <textarea
        ref={ref}
        data-block-editor
        value={val}
        onChange={handleChange}
        onFocus={() => {
          focusedRef.current = true;
          setIsFocused(true);
          onActiveChange?.(block.id, true);
        }}
        onBlur={() => {
          focusedRef.current = false;
          flush();
          onActiveChange?.(block.id, false);
          setTimeout(() => setIsFocused(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder[block.block_type]}
        rows={1}
        className="w-full bg-transparent border-none outline-none resize-none rounded px-1 -mx-1 placeholder:text-muted-foreground/60 caret-primary min-h-[1.5em]"
        style={{
          fontFamily: "inherit",
          fontSize: "inherit",
          color: "inherit",
          textAlign: "inherit",
          textTransform: "inherit",
          fontWeight: "inherit",
          fontStyle: "inherit",
        } as any}
      />

      {showAutocomplete && (
        <CharacterAutocomplete
          query={val}
          characters={characters}
          anchorRef={ref as any}
          onPick={(c) => {
            setVal(c.name.toUpperCase());
            void onSave({ content: c.name.toUpperCase() });
            ref.current?.blur();
          }}
          onCreate={async (name) => {
            try {
              const created = await onCreateCharacter(name);
              const finalName = (created?.name ?? name).toUpperCase();
              setVal(finalName);
              void onSave({ content: finalName });
              ref.current?.blur();
            } catch {
              /* keep typed text */
            }
          }}
        />
      )}

      {isSceneHeading && (
        <div className="absolute right-0 -bottom-7 z-10 font-sans">
          <SceneBeatPicker
            value={beat}
            onChange={(b) => {
              const next = { ...(block.metadata || {}), beat: b ?? undefined };
              if (b === null) delete (next as any).beat;
              void onSave({ metadata: next });
            }}
          />
        </div>
      )}

      {isFocused && !slashOpen && (
        <div
          data-block-toolbar
          className="absolute right-0 -top-7 z-10 flex items-center gap-0.5 rounded-md border border-border/60 bg-popover/95 backdrop-blur shadow-sm px-1 py-0.5 font-sans"
        >
          {QUICK_TYPES.map((t) => {
            const meta = BLOCK_TYPES.find((b) => b.value === t)!;
            const active = block.block_type === t;
            return (
              <button
                key={t}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void onSave({ block_type: t });
                }}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title={meta.label}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {slashOpen && filtered.length > 0 && (
        <div
          ref={menuRef}
          className="absolute left-0 top-full mt-1 z-50 w-56 rounded-md border border-border bg-popover shadow-lg p-1 font-sans"
        >
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Command className="h-3 w-3" /> Insert block
          </div>
          {filtered.map((t, i) => (
            <button
              key={t.value}
              className={`w-full text-left flex items-center justify-between px-2 py-1.5 text-xs rounded-sm transition-colors ${
                i === selectedIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
              }`}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={(e) => {
                e.stopPropagation();
                executeSlash(t.value);
              }}
            >
              <div className="flex flex-col">
                <span>{t.label}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {t.aliases.slice(0, 3).join(" ")}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">{t.shortcut}</span>
            </button>
          ))}
        </div>
      )}

      <div className="absolute -left-12 top-0 opacity-0 group-hover:opacity-100 transition flex flex-col gap-0.5 font-sans">
        <Select value={block.block_type} onValueChange={(v) => void onSave({ block_type: v })}>
          <SelectTrigger className="h-6 w-10 text-[10px] px-1">
            <span>{(block.block_type || "a")[0].toUpperCase()}</span>
          </SelectTrigger>
          <SelectContent>
            {BLOCK_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
