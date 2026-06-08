import { useEffect, useMemo, useRef, useState } from "react";
import { UserPlus, User } from "lucide-react";

export type CharacterHit = { id: string; name: string; role?: string | null };

export function CharacterAutocomplete({
  query,
  characters,
  onPick,
  onCreate,
  anchorRef,
}: {
  query: string;
  characters: CharacterHit[];
  onPick: (c: CharacterHit) => void;
  onCreate: (name: string) => void;
  anchorRef: React.RefObject<HTMLElement>;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return characters.slice(0, 6);
    return characters
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, characters]);

  const exact = useMemo(
    () => matches.some((m) => m.name.toLowerCase() === query.trim().toLowerCase()),
    [matches, query],
  );

  useEffect(() => { setSelectedIdx(0); }, [query]);

  // Keyboard nav delegated by parent textarea via custom events
  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (matches.length === 0 && exact) return;
      const total = matches.length + (!exact && query.trim() ? 1 : 0);
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => (i + 1) % total); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => (i - 1 + total) % total); }
      else if (e.key === "Enter" || e.key === "Tab") {
        if (selectedIdx < matches.length) {
          e.preventDefault(); onPick(matches[selectedIdx]);
        } else if (!exact && query.trim()) {
          e.preventDefault(); onCreate(query.trim());
        }
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [anchorRef, matches, selectedIdx, exact, query, onPick, onCreate]);

  if (matches.length === 0 && (exact || !query.trim())) return null;

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 z-50 w-64 rounded-md border border-border bg-popover shadow-lg p-1 font-sans"
    >
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Cast
      </div>
      {matches.map((c, i) => (
        <button
          key={c.id}
          onMouseDown={(e) => { e.preventDefault(); onPick(c); }}
          onMouseEnter={() => setSelectedIdx(i)}
          className={`w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm ${
            i === selectedIdx ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
          }`}
        >
          <User className="h-3 w-3 shrink-0 opacity-60" />
          <span className="flex-1 truncate">{c.name}</span>
          {c.role && <span className="text-[10px] text-muted-foreground truncate">{c.role}</span>}
        </button>
      ))}
      {!exact && query.trim() && (
        <button
          onMouseDown={(e) => { e.preventDefault(); onCreate(query.trim()); }}
          onMouseEnter={() => setSelectedIdx(matches.length)}
          className={`w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm border-t border-border/40 mt-1 ${
            selectedIdx === matches.length ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
          }`}
        >
          <UserPlus className="h-3 w-3 shrink-0" />
          <span>Add <strong className="uppercase">{query.trim()}</strong> to cast</span>
        </button>
      )}
    </div>
  );
}
