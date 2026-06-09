import { AlertTriangle } from "lucide-react";

export function SaveStatusBanner({
  visible,
  failedCount,
  onRetry,
  onCopyAll,
}: {
  visible: boolean;
  failedCount: number;
  onRetry: () => void;
  onCopyAll: () => void;
}) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      className="max-w-[760px] mx-auto mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-3 font-sans"
    >
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-destructive">
          {failedCount > 0
            ? `${failedCount} line${failedCount === 1 ? "" : "s"} aren't saving to the cloud`
            : "Some lines aren't saving to the cloud"}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Your text is still on this device and will be restored if you reload. Keep writing — we'll keep retrying. As a backup you can copy the whole script to your clipboard.
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onRetry}
          className="text-xs px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/20 transition"
        >
          Retry now
        </button>
        <button
          onClick={onCopyAll}
          className="text-xs px-3 py-1.5 rounded-md border border-border/60 hover:bg-card/60 transition"
        >
          Copy all
        </button>
      </div>
    </div>
  );
}
