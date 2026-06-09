import { useEffect, useMemo, useRef, useState } from "react";
import { Command, BookPlus, X as XIcon, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cycleType } from "./screenplayKeymap";
import { detectBlockType, BLOCK_LABEL } from "@/lib/editor/autoFormat";
import { formatBlockText, analyzeFormat } from "./screenplayAutoFormat";
import {
  applySafeLanguageFixes,
  analyzeUnknownTerms,
  type LanguageContext,
} from "./screenplayLanguageIntelligence";
import { CharacterAutocomplete, type CharacterHit } from "@/components/editor/CharacterAutocomplete";
import { SceneBeatPicker } from "@/components/editor/SceneBeatPicker";
import type { LocalBlock } from "./useScreenplayDocument";


const BLOCK_TYPES = [
  { value: "scene_heading", label: "Scene Heading", shortcut: "/scene", aliases: ["/heading", "/h", "/int", "/ext"] },
  { value: "action", label: "Action", shortcut: "/action", aliases: ["/a", "/desc"] },
  { value: "character", label: "Character", shortcut: "/character", aliases: ["/char", "/c"] },
  { value: "dialogue", label: "Dialogue", shortcut: "/dialogue", aliases: ["/dia", "/d"] },
  { value: "parenthetical", label: "Parenthetical", shortcut: "/parenthetical", aliases: ["/p", "/wryly"] },
  { value: "transition", label: "Transition", shortcut: "/transition", aliases: ["/trans", "/t", "/cut"] },
  { value: "shot", label: "Shot", shortcut: "/shot", aliases: ["/s", "/angle"] },
  { value: "note", label: "Note", shortcut: "/note", aliases: ["/n"] },
];

const PLACEHOLDERS: Record<string, string> = {
  scene_heading: "INT. LOCATION - DAY",
  action: "Describe what we see...",
  character: "CHARACTER NAME",
  dialogue: "What they say...",
  parenthetical: "(beat)",
  transition: "CUT TO:",
  shot: "CLOSE ON",
  note: "Note to self...",
};

const QUICK_TYPES = ["scene_heading", "action", "character", "dialogue", "parenthetical"] as const;

export type AutoFormatEvent = {
  blockId: string;
  blockType: string;
  original: string;
  formatted: string;
  typeChanged: boolean;
  /** Set when a high-confidence language fix (e.g. i → I) was applied. */
  languageFixKind?: "capitalize_i" | "sentence_start";
};

export function ScreenplayLine({
  block,
  isActive,
  isFirstEmpty,
  characters,
  prevBlockType,
  onContentChange,
  onChangeType,
  onUpdateMetadata,
  onEnter,
  onDeleteEmpty,
  onSlashInsert,
  onFocus,
  onCreateCharacter,
  onAutoFormatApplied,
  languageContext,
  onAddDictionaryTerm,
  onRejectFormatSuggestion,
}: {
  block: LocalBlock;
  isActive: boolean;
  isFirstEmpty?: boolean;
  characters: CharacterHit[];
  /** Previous block's type — used by analyzeFormat for context-sensitive suggestions. */
  prevBlockType?: string;
  onContentChange: (c: string) => void;
  onChangeType: (t: string) => void;
  onUpdateMetadata: (m: any) => void;
  onEnter: () => void;
  onDeleteEmpty: () => void;
  onSlashInsert: (type: string) => void;
  onFocus: () => void;
  onCreateCharacter: (name: string) => Promise<any>;
  onAutoFormatApplied?: (e: AutoFormatEvent) => void;
  /** Project-aware language intelligence context. Optional. */
  languageContext?: LanguageContext;
  /** When provided, the "Add to Project Dictionary" chip becomes interactive. */
  onAddDictionaryTerm?: (term: string, category?: "character" | "location" | "custom") => void;
  /** Called when the writer dismisses a structural format suggestion. */
  onRejectFormatSuggestion?: (original: string, suggestedType: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);


  // auto-resize. For empty content, clear the inline height so the CSS
  // min-height (which keeps the line visible/tappable on mobile) can apply.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    if (block.content.length === 0) return;
    el.style.height = el.scrollHeight + "px";
  }, [block.content]);

  // focus on becoming active (e.g. after Enter creates this block)
  useEffect(() => {
    if (!isActive || !ref.current) return;
    if (document.activeElement === ref.current) return;
    ref.current.focus();
    try {
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    } catch {}
  }, [isActive]);

  // slash menu
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashStart, setSlashStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const query = slashOpen && slashStart >= 0 ? block.content.slice(slashStart + 1).toLowerCase() : "";
  const filtered = BLOCK_TYPES.filter(
    (t) =>
      t.label.toLowerCase().includes(query) ||
      t.value.toLowerCase().includes(query) ||
      t.shortcut.toLowerCase().includes(query) ||
      t.aliases.some((a) => a.toLowerCase().includes(query)),
  );
  const closeSlash = () => {
    setSlashOpen(false);
    setSlashStart(-1);
    setSelectedIndex(0);
  };
  useEffect(() => {
    if (!slashOpen) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeSlash();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [slashOpen]);

  const executeSlash = (type: string) => {
    const before = block.content.slice(0, slashStart);
    onContentChange(before);
    closeSlash();
    onSlashInsert(type);
  };

  // Anti-fight guard: remember the most recent string we auto-applied so we
  // don't keep re-applying it after the writer edits back. Reset on clear.
  const lastAppliedFormatRef = useRef<string | null>(null);
  // One-shot type detection per block lifetime (Enter/blur only, not per keystroke).
  const autoTypedRef = useRef(false);
  useEffect(() => {
    if (block.content === "") {
      lastAppliedFormatRef.current = null;
      autoTypedRef.current = false;
    }
  }, [block.content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    onContentChange(v);
    if (slashOpen && (slashStart >= v.length || v[slashStart] !== "/")) closeSlash();
  };

  /**
   * Run safe formatting on the current block. Returns true if anything changed.
   * Called only at Enter / blur — never per keystroke — so caret stability is preserved.
   *
   * Pipeline (order matters per docs):
   *   1) applySafeLanguageFixes — high-confidence language fixes (i → I, etc.)
   *   2) detectBlockType — one-shot type detection
   *   3) formatBlockText — structural formatting for the (possibly new) type
   */
  const runSafeFormat = (): boolean => {
    const raw = block.content;
    if (!raw) return false;

    // 1) Language fixes first — they only change casing/punctuation, never
    //    semantic meaning, and skip any token in characterNames / dictionary.
    const langCtx: LanguageContext = languageContext
      ? { ...languageContext, blockType: block.block_type }
      : { blockType: block.block_type };
    const langResult = applySafeLanguageFixes(raw, langCtx);
    let working = langResult.text;

    // 2) Type detection (one-shot).
    let effectiveType = block.block_type;
    let typeChanged = false;
    if (!autoTypedRef.current) {
      const detected = detectBlockType(working);
      if (detected && detected !== block.block_type) {
        autoTypedRef.current = true;
        onChangeType(detected);
        effectiveType = detected;
        typeChanged = true;
        toast.success(`Auto-formatted as ${BLOCK_LABEL[detected]}`, { duration: 1200 });
      }
    }

    // 3) Structural format.
    const formatted = formatBlockText(effectiveType, working);

    if (formatted === raw && !typeChanged) return false;
    if (formatted === lastAppliedFormatRef.current && !typeChanged) return false;
    if (formatted !== raw) {
      lastAppliedFormatRef.current = formatted;
      onContentChange(formatted);
    }
    onAutoFormatApplied?.({
      blockId: block.id,
      blockType: effectiveType,
      original: raw,
      formatted,
      typeChanged,
      languageFixKind: langResult.fixes[0]?.kind,
    });
    return true;
  };

  // ---------- unknown-term suggestions (passive, blur/idle only) ----------
  const [unknownTerms, setUnknownTerms] = useState<string[]>([]);
  const [dismissedTerms, setDismissedTerms] = useState<Set<string>>(new Set());
  useEffect(() => {
    // Re-scan only when block content settles (debounced) and the line is
    // not actively being typed. Never per keystroke.
    if (!languageContext) return;
    if (focused) return;
    const id = setTimeout(() => {
      const decisions = analyzeUnknownTerms(block.content, {
        ...languageContext,
        blockType: block.block_type,
      });
      setUnknownTerms(decisions.map((d) => d.term));
    }, 400);
    return () => clearTimeout(id);
  }, [block.content, block.block_type, focused, languageContext]);

  const visibleUnknowns = useMemo(
    () => unknownTerms.filter((t) => !dismissedTerms.has(t.toLowerCase())),
    [unknownTerms, dismissedTerms],
  );

  // ---------- medium-confidence structural suggestion (idle, blur-only) ----------
  const [suggestion, setSuggestion] = useState<{
    type: string;
    reason: string;
    transformedText: string;
    fromContent: string;
  } | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (focused) return;
    if (!block.content.trim()) { setSuggestion(null); return; }
    const id = setTimeout(() => {
      const decision = analyzeFormat(block.content, {
        currentBlockType: block.block_type,
        prevBlockType,
        characterNames: languageContext?.characterNames,
      });
      if (
        decision.confidence === "medium" &&
        decision.suggestedType !== block.block_type &&
        !dismissedSuggestions.has(`${block.block_type}>${decision.suggestedType}|${block.content}`)
      ) {
        setSuggestion({
          type: decision.suggestedType,
          reason: decision.reason,
          transformedText: decision.transformedText,
          fromContent: block.content,
        });
      } else {
        setSuggestion(null);
      }
    }, 600);
    return () => clearTimeout(id);
  }, [block.content, block.block_type, focused, prevBlockType, languageContext?.characterNames, dismissedSuggestions]);

  const acceptSuggestion = () => {
    if (!suggestion) return;
    onChangeType(suggestion.type);
    if (suggestion.transformedText !== block.content) {
      onContentChange(suggestion.transformedText);
    }
    setSuggestion(null);
    toast.success(`→ ${BLOCK_LABEL[suggestion.type] ?? suggestion.type}`, { duration: 1000 });
  };
  const dismissSuggestion = () => {
    if (!suggestion) return;
    setDismissedSuggestions((s) =>
      new Set(s).add(`${block.block_type}>${suggestion.type}|${suggestion.fromContent}`),
    );
    onRejectFormatSuggestion?.(suggestion.fromContent, suggestion.type);
    setSuggestion(null);
  };


  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen) {
      if (e.key === "Escape") { e.preventDefault(); closeSlash(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => (i + 1) % Math.max(1, filtered.length)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => (i - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length)); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filtered[selectedIndex]) executeSlash(filtered[selectedIndex].value);
        return;
      }
    } else {
      if (e.key === "Tab") {
        e.preventDefault();
        const next = cycleType(block.block_type, e.shiftKey ? -1 : 1);
        onChangeType(next);
        toast.success(`→ ${BLOCK_LABEL[next] ?? next}`, { duration: 800 });
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        runSafeFormat();
        onEnter();
        return;
      }
      // Shift+Enter: allow soft newline default for action/note, else new block
      if (e.key === "Enter" && e.shiftKey) {
        if (block.block_type === "action" || block.block_type === "note") return; // default newline
        e.preventDefault();
        runSafeFormat();
        onEnter();
        return;
      }
      if (e.key === "Backspace" && block.content === "") {
        e.preventDefault();
        onDeleteEmpty();
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

  const isCharBlock = block.block_type === "character";
  const isSceneHeading = block.block_type === "scene_heading";
  const showAutocomplete = isCharBlock && focused && !slashOpen;
  const beat = (block.metadata as any)?.beat ?? null;

  return (
    <div
      className={`group relative blk-${block.block_type} border-l-2 pl-3 -ml-3 transition-colors ${
        focused ? "border-primary bg-primary/[0.04]" : "border-transparent hover:border-border"
      }`}
      data-block-id={block.serverId ?? block.id}
    >
      <textarea
        ref={ref}
        data-block-editor
        value={block.content}
        onChange={handleChange}
        onFocus={() => { setFocused(true); onFocus(); }}
        onBlur={() => {
          // Run safe formatting on blur. Defer focus-state flip so the
          // autocomplete/toolbar can still hand focus back without flicker.
          runSafeFormat();
          setTimeout(() => setFocused(false), 120);
        }}
        onKeyDown={handleKeyDown}
        placeholder={
          isFirstEmpty
            ? "INT. LOCATION — DAY   ·   tap here and start your screenplay"
            : PLACEHOLDERS[block.block_type]
        }
        rows={1}
        className="w-full bg-transparent border-none outline-none resize-none rounded px-1 -mx-1 caret-primary"
        style={{
          fontFamily: "inherit",
          fontSize: "inherit",
          color: "inherit",
          textAlign: "inherit",
          textTransform: "inherit",
          fontWeight: "inherit",
          fontStyle: "inherit",
          minHeight: "2.5em",
          height: block.content.length === 0 ? "2.5em" : undefined,
          display: "block",
        } as any}
      />

      {visibleUnknowns.length > 0 && !focused && (
        <div className="mt-1 flex flex-wrap items-center gap-1 font-sans">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            New word
          </span>
          {visibleUnknowns.slice(0, 4).map((term) => (
            <div
              key={term}
              className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[11px] text-foreground/80"
              title="SceneSmith hasn't seen this word before. Add it to the project so it's never flagged again."
            >
              <span className="font-mono">{term}</span>
              {onAddDictionaryTerm && (
                <>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onAddDictionaryTerm(term, "character");
                      setDismissedTerms((s) => new Set(s).add(term.toLowerCase()));
                    }}
                    className="ml-1 inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-amber-500/10 transition"
                    title="Add as character"
                  >
                    <BookPlus className="h-3 w-3" />
                    Character
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onAddDictionaryTerm(term, "custom");
                      setDismissedTerms((s) => new Set(s).add(term.toLowerCase()));
                    }}
                    className="inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-amber-500/10 transition"
                    title="Add to project dictionary"
                  >
                    Term
                  </button>
                </>
              )}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDismissedTerms((s) => new Set(s).add(term.toLowerCase()));
                }}
                className="ml-0.5 inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground/70 hover:text-foreground hover:bg-amber-500/10 transition"
                title="Ignore"
                aria-label="Ignore"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}



      {showAutocomplete && (
        <CharacterAutocomplete
          query={block.content}
          characters={characters}
          anchorRef={ref as any}
          onPick={(c) => {
            onContentChange(c.name.toUpperCase());
            ref.current?.blur();
          }}
          onCreate={async (name) => {
            try {
              const created = await onCreateCharacter(name);
              onContentChange(((created?.name ?? name) as string).toUpperCase());
              ref.current?.blur();
            } catch {}
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
              onUpdateMetadata(next);
            }}
          />
        </div>
      )}

      {focused && !slashOpen && (
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
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChangeType(t);
                  // Keep mobile keyboard open and caret in the textarea.
                  requestAnimationFrame(() => ref.current?.focus());
                }}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
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
              type="button"
              className={`w-full text-left flex items-center justify-between px-2 py-1.5 text-xs rounded-sm transition-colors ${
                i === selectedIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
              }`}
              onMouseEnter={() => setSelectedIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                executeSlash(t.value);
                requestAnimationFrame(() => ref.current?.focus());
              }}
            >
              <div className="flex flex-col">
                <span>{t.label}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{t.aliases.slice(0, 3).join(" ")}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">{t.shortcut}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
