import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { promoteApprovedCharactersForDocument } from "@/lib/importation/candidates.functions";

const BodySchema = z.object({
  document_id: z.string().uuid(),
  project_id: z.string().uuid(),
  include_pending: z.boolean().optional().default(false),
});

type PromoteInput = z.infer<typeof BodySchema>;
type PromoteResult = Awaited<
  ReturnType<typeof promoteApprovedCharactersForDocument>
>;

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------
// Promotion is inherently idempotent (see promotion.test.ts) — repeated runs
// reuse existing promoted_ref lineage. This layer adds two extra guarantees:
//
// 1. In-flight coalescing: concurrent requests for the same
//    (document_id, include_pending, [idempotency-key]) share one execution
//    and receive the same response body. Prevents duplicate work on
//    double-clicks / retries.
// 2. Short-window response cache: for TTL_MS after a successful run, repeat
//    requests return the cached segment_map without touching the DB.
//
// An optional `Idempotency-Key` request header narrows the cache scope so
// distinct client intents (e.g. different UI actions) never collide.
// ---------------------------------------------------------------------------

const TTL_MS = 30_000;
const MAX_ENTRIES = 500;

type Entry = {
  key: string;
  inFlight?: Promise<PromoteResult>;
  result?: PromoteResult;
  cachedAt?: number;
};

const cache = new Map<string, Entry>();

function cacheKey(input: PromoteInput, idemKey: string | null): string {
  return [
    idemKey ?? "-",
    input.document_id,
    input.include_pending ? "1" : "0",
  ].join("|");
}

function pruneExpired(now: number) {
  for (const [k, v] of cache) {
    if (!v.inFlight && v.cachedAt !== undefined && now - v.cachedAt > TTL_MS) {
      cache.delete(k);
    }
  }
  // Hard cap — drop oldest entries first.
  if (cache.size > MAX_ENTRIES) {
    const overflow = cache.size - MAX_ENTRIES;
    let i = 0;
    for (const k of cache.keys()) {
      if (i++ >= overflow) break;
      cache.delete(k);
    }
  }
}

async function runIdempotent(
  input: PromoteInput,
  idemKey: string | null,
): Promise<{ result: PromoteResult; replayed: boolean }> {
  const now = Date.now();
  const key = cacheKey(input, idemKey);
  pruneExpired(now);

  const existing = cache.get(key);
  if (existing?.inFlight) {
    return { result: await existing.inFlight, replayed: true };
  }
  if (
    existing?.result &&
    existing.cachedAt !== undefined &&
    now - existing.cachedAt <= TTL_MS
  ) {
    return { result: existing.result, replayed: true };
  }

  const promise = (async () => {
    try {
      const result = await promoteApprovedCharactersForDocument({
        data: input,
      });
      cache.set(key, { key, result, cachedAt: Date.now() });
      return result;
    } catch (err) {
      cache.delete(key);
      throw err;
    }
  })();

  cache.set(key, { key, inFlight: promise });
  const result = await promise;
  return { result, replayed: false };
}

export const Route = createFileRoute("/api/importation/promote-characters")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth || !auth.startsWith("Bearer ")) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: Bearer token required" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        let payload: PromoteInput;
        try {
          const raw = await request.json();
          payload = BodySchema.parse(raw);
        } catch (err) {
          return new Response(
            JSON.stringify({
              error: "Invalid request body",
              detail: err instanceof Error ? err.message : String(err),
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const idemKey =
          request.headers.get("idempotency-key")?.slice(0, 128) ?? null;

        try {
          const { result, replayed } = await runIdempotent(payload, idemKey);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Idempotent-Replay": replayed ? "true" : "false",
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const status = /unauthorized/i.test(message)
            ? 401
            : /not found/i.test(message)
              ? 404
              : 500;
          return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
