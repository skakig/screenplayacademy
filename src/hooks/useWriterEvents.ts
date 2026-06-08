import { useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { emitWriterEvent, type WriterEventInput } from "@/lib/its/writerEvents.functions";

/**
 * Fire-and-forget writer-event emitter.
 * Debounces identical event_type+project_id pairs to 1/sec to avoid hot-path spam.
 */
export function useWriterEvents() {
  const emit = useServerFn(emitWriterEvent);
  const lastFire = useRef<Map<string, number>>(new Map());

  const fire = useCallback(
    (input: WriterEventInput) => {
      const key = `${input.event_type}:${input.project_id ?? ""}`;
      const now = Date.now();
      const last = lastFire.current.get(key) ?? 0;
      if (now - last < 1000) return;
      lastFire.current.set(key, now);
      // fire-and-forget
      void emit({ data: input }).catch(() => {
        /* swallow — telemetry must never break UX */
      });
    },
    [emit]
  );

  return fire;
}
