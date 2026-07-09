import { useCallback, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { emitWriterEvent, type WriterEventInput } from "@/lib/its/writerEvents.functions";
import { aggregateWriterProfile } from "@/lib/its/writerProfile.functions";

const AGGREGATE_EVERY_N = 25;

/**
 * Fire-and-forget writer-event emitter.
 * Debounces identical event_type+project_id pairs to 1/sec.
 * Every N emitted events (and on unmount) fires aggregateWriterProfile so
 * skill scores stay fresh without a full round-trip per keystroke.
 */
export function useWriterEvents() {
  const emit = useServerFn(emitWriterEvent);
  const aggregate = useServerFn(aggregateWriterProfile);
  const lastFire = useRef<Map<string, number>>(new Map());
  const emittedSinceAgg = useRef(0);
  const aggInFlight = useRef(false);

  const runAggregate = useCallback(() => {
    if (aggInFlight.current) return;
    aggInFlight.current = true;
    emittedSinceAgg.current = 0;
    void aggregate()
      .catch(() => {
        /* silent — telemetry aggregation must never break UX */
      })
      .finally(() => {
        aggInFlight.current = false;
      });
  }, [aggregate]);

  const fire = useCallback(
    (input: WriterEventInput) => {
      const key = `${input.event_type}:${input.project_id ?? ""}`;
      const now = Date.now();
      const last = lastFire.current.get(key) ?? 0;
      if (now - last < 1000) return;
      lastFire.current.set(key, now);
      void emit({ data: input }).catch(() => {
        /* swallow — telemetry must never break UX */
      });
      emittedSinceAgg.current += 1;
      if (emittedSinceAgg.current >= AGGREGATE_EVERY_N) {
        runAggregate();
      }
    },
    [emit, runAggregate]
  );

  // Flush on unmount / navigation so partial sessions still update skills.
  useEffect(() => {
    return () => {
      if (emittedSinceAgg.current > 0) runAggregate();
    };
  }, [runAggregate]);

  return fire;
}
