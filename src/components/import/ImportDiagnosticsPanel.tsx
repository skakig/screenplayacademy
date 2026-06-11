import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertTriangle, Info, AlertCircle, Check, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  getImportReport,
  setRecommendationAccepted,
} from "@/lib/import/diagnose.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string | null;
};

type Warning = {
  id: string;
  severity: string;
  type: string;
  message: string;
};
type Recommendation = {
  id: string;
  kind: string;
  payload: { title?: string; body?: string } | null;
  accepted: boolean | null;
};
type Report = {
  id: string;
  summary: string | null;
  counts: Record<string, number> | null;
  created_at: string;
};

const SEVERITY_STYLE: Record<string, string> = {
  error: "bg-rose-500/15 text-rose-200 border-rose-500/30",
  warning: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  info: "bg-sky-500/15 text-sky-200 border-sky-500/30",
};

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "error") return <AlertCircle className="h-3.5 w-3.5" />;
  if (severity === "warning") return <AlertTriangle className="h-3.5 w-3.5" />;
  return <Info className="h-3.5 w-3.5" />;
}

export function ImportDiagnosticsPanel({ open, onOpenChange, reportId }: Props) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);

  const getReport = useServerFn(getImportReport);
  const setAccepted = useServerFn(setRecommendationAccepted);

  useEffect(() => {
    if (!open || !reportId) return;
    let cancelled = false;
    setBusy(true);
    getReport({ data: { reportId } })
      .then((res) => {
        if (cancelled) return;
        setReport(res.report as Report);
        setWarnings(res.warnings as Warning[]);
        setRecs(res.recommendations as Recommendation[]);
      })
      .catch((e) => toast.error(e?.message ?? "Couldn't load report"))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [open, reportId, getReport]);

  const decide = async (rec: Recommendation, accepted: boolean) => {
    const prev = rec.accepted;
    setRecs((rs) => rs.map((r) => (r.id === rec.id ? { ...r, accepted } : r)));
    try {
      await setAccepted({ data: { recommendationId: rec.id, accepted } });
    } catch (e: any) {
      setRecs((rs) => rs.map((r) => (r.id === rec.id ? { ...r, accepted: prev } : r)));
      toast.error(e?.message ?? "Couldn't save");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Import diagnostics
          </DialogTitle>
          <DialogDescription>
            AI-assisted review of formatting, structure, characters, and world consistency.
          </DialogDescription>
        </DialogHeader>

        {busy && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Reading the report…
          </div>
        )}

        {!busy && report && (
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-4">
              {report.summary && (
                <section className="rounded-md border border-border/60 bg-card/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Summary
                  </p>
                  <p className="text-sm leading-relaxed">{report.summary}</p>
                </section>
              )}

              <section>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Warnings ({warnings.length})
                </p>
                {warnings.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">
                    No warnings flagged.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {warnings.map((w) => (
                      <li
                        key={w.id}
                        className={`flex gap-2 items-start text-xs rounded border px-2 py-1.5 ${SEVERITY_STYLE[w.severity] ?? SEVERITY_STYLE.info}`}
                      >
                        <SeverityIcon severity={w.severity} />
                        <div className="min-w-0">
                          <p className="font-medium">{w.type}</p>
                          <p className="opacity-90">{w.message}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Recommendations ({recs.length})
                </p>
                {recs.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">
                    Nothing to act on right now.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {recs.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-md border border-border/60 bg-card/40 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {r.payload?.title ?? r.kind}
                            </p>
                            {r.kind && (
                              <Badge variant="outline" className="text-[10px] mt-0.5">
                                {r.kind}
                              </Badge>
                            )}
                          </div>
                          {r.accepted === true && (
                            <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30 text-[10px]">
                              Accepted
                            </Badge>
                          )}
                          {r.accepted === false && (
                            <Badge className="bg-rose-500/20 text-rose-200 border-rose-500/30 text-[10px]">
                              Dismissed
                            </Badge>
                          )}
                        </div>
                        {r.payload?.body && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {r.payload.body}
                          </p>
                        )}
                        {r.accepted == null && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => decide(r, true)}
                            >
                              <Check className="h-3 w-3 mr-1" /> Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground"
                              onClick={() => decide(r, false)}
                            >
                              <X className="h-3 w-3 mr-1" /> Dismiss
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
