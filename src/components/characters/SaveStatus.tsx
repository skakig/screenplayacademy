import { Loader2, Check, AlertTriangle, CircleDot } from "lucide-react";
import { useEffect, useState } from "react";
import type { AutosaveStatus } from "@/hooks/use-autosave";

export function SaveStatus({
  status,
  lastSavedAt,
  onRetry,
}: {
  status: AutosaveStatus;
  lastSavedAt: number | null;
  onRetry?: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 10000);
    return () => clearInterval(id);
  }, []);

  if (status === "saving") {
    return <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving…</span>;
  }
  if (status === "error") {
    return (
      <button onClick={onRetry} className="text-[11px] text-destructive inline-flex items-center gap-1 hover:underline">
        <AlertTriangle className="h-3 w-3" />Save failed — retry
      </button>
    );
  }
  if (status === "dirty") {
    return <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><CircleDot className="h-3 w-3" />Unsaved changes</span>;
  }
  if (status === "saved" && lastSavedAt) {
    return <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Check className="h-3 w-3 text-primary" />Saved · {timeAgo(lastSavedAt)}</span>;
  }
  return <span className="text-[11px] text-muted-foreground">All changes saved</span>;
}

function timeAgo(t: number): string {
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
