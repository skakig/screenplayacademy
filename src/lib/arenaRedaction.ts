/**
 * Arena identity redaction — defensive client-side helper.
 *
 * The authoritative redaction lives in SECURITY DEFINER RPCs
 * (`get_arena_voting_entries`, RLS on `arena_awards`) which strip
 * `author_id` / `awarded_to` while a session is blind and pre-finalize.
 *
 * This helper is a belt-and-suspenders pass applied by UI code before
 * rendering, so that any accidental leak (a mis-typed select, a legacy
 * cached payload, a third-party echo) still can't reveal authorship.
 *
 * Rules:
 * - Nulls `author_id` on every entry-shaped object.
 * - Nulls `awarded_to` on every award-shaped object.
 * - Preserves the viewer's own id (self-view is always allowed).
 * - Recurses into arrays and nested objects (RPC envelopes, `{ data: [...] }`).
 * - Never mutates the input; always returns a fresh value.
 * - Leaves all non-identity fields untouched.
 */

const IDENTITY_FIELDS = ["author_id", "awarded_to"] as const;
type IdentityField = (typeof IDENTITY_FIELDS)[number];

export interface RedactOptions {
  /** Viewer's own user id — never redacted (self-view). */
  viewerId?: string | null;
  /**
   * When true, identity is preserved (post-finalize / named rounds).
   * Defaults to false — assume blind unless the caller proves otherwise.
   */
  reveal?: boolean;
}

/**
 * Redact `author_id` and `awarded_to` from an arbitrary payload shape.
 * Handles: single row, array of rows, RPC-style `{ data, error }` envelopes,
 * and arbitrarily nested objects.
 */
export function redactIdentity<T>(payload: T, opts: RedactOptions = {}): T {
  if (opts.reveal) return payload;
  return walk(payload, opts.viewerId ?? null) as T;
}

function walk(value: unknown, viewerId: string | null): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => walk(v, viewerId));
  if (typeof value !== "object") return value;

  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  let touched = false;

  for (const key of Object.keys(src)) {
    const v = src[key];
    if ((IDENTITY_FIELDS as readonly string[]).includes(key)) {
      const field = key as IdentityField;
      const redacted = redactField(field, v, viewerId);
      out[field] = redacted;
      if (redacted !== v) touched = true;
      continue;
    }
    const next = walk(v, viewerId);
    out[key] = next;
    if (next !== v) touched = true;
  }

  // Preserve reference identity when nothing changed — makes it cheap to
  // wrap already-clean payloads.
  return touched ? out : value;
}

function redactField(
  _field: IdentityField,
  value: unknown,
  viewerId: string | null,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  if (viewerId && value === viewerId) return value;
  return null;
}
