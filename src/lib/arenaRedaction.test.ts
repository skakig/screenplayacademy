import { describe, expect, it } from "vitest";
import { redactIdentity } from "./arenaRedaction";

const VIEWER = "viewer-uuid";
const OTHER = "other-uuid";
const THIRD = "third-uuid";

describe("redactIdentity", () => {
  it("nulls author_id on a single entry row", () => {
    const row = { id: "e1", body: "hi", author_id: OTHER };
    const out = redactIdentity(row);
    expect(out).toEqual({ id: "e1", body: "hi", author_id: null });
  });

  it("nulls awarded_to on a single award row", () => {
    const row = { id: "a1", award_type: "best_line", awarded_to: OTHER };
    const out = redactIdentity(row);
    expect(out).toEqual({ id: "a1", award_type: "best_line", awarded_to: null });
  });

  it("nulls both fields on a row that carries both", () => {
    const row = {
      id: "x1",
      author_id: OTHER,
      awarded_to: THIRD,
      note: "keep",
    };
    expect(redactIdentity(row)).toEqual({
      id: "x1",
      author_id: null,
      awarded_to: null,
      note: "keep",
    });
  });

  it("redacts every element of a list payload", () => {
    const list = [
      { id: "1", author_id: OTHER },
      { id: "2", author_id: THIRD },
      { id: "3", author_id: null },
    ];
    expect(redactIdentity(list)).toEqual([
      { id: "1", author_id: null },
      { id: "2", author_id: null },
      { id: "3", author_id: null },
    ]);
  });

  it("recurses into RPC-style { data, error } envelopes", () => {
    const env = {
      error: null,
      data: [
        { id: "1", author_id: OTHER, nested: { awarded_to: THIRD } },
      ],
    };
    expect(redactIdentity(env)).toEqual({
      error: null,
      data: [
        { id: "1", author_id: null, nested: { awarded_to: null } },
      ],
    });
  });

  it("recurses into deeply nested containers (arrays inside objects inside arrays)", () => {
    const payload = {
      rounds: [
        {
          entries: [
            { id: "e", author_id: OTHER },
            { id: "f", author_id: THIRD },
          ],
          awards: [{ id: "a", awarded_to: OTHER }],
        },
      ],
    };
    const out = redactIdentity(payload) as typeof payload;
    expect(out.rounds[0].entries.every((e) => e.author_id === null)).toBe(true);
    expect(out.rounds[0].awards.every((a) => a.awarded_to === null)).toBe(true);
  });

  it("preserves the viewer's own author_id (self-view)", () => {
    const row = { id: "e1", author_id: VIEWER };
    expect(redactIdentity(row, { viewerId: VIEWER })).toEqual({
      id: "e1",
      author_id: VIEWER,
    });
  });

  it("preserves the viewer's own awarded_to (self-view)", () => {
    const row = { id: "a1", awarded_to: VIEWER };
    expect(redactIdentity(row, { viewerId: VIEWER })).toEqual({
      id: "a1",
      awarded_to: VIEWER,
    });
  });

  it("redacts every non-viewer id in a mixed list even when viewer is set", () => {
    const list = [
      { id: "1", author_id: VIEWER },
      { id: "2", author_id: OTHER },
      { id: "3", author_id: THIRD },
    ];
    expect(redactIdentity(list, { viewerId: VIEWER })).toEqual([
      { id: "1", author_id: VIEWER },
      { id: "2", author_id: null },
      { id: "3", author_id: null },
    ]);
  });

  it("returns payload unchanged when reveal=true (post-finalize)", () => {
    const row = { id: "e1", author_id: OTHER, awarded_to: THIRD };
    expect(redactIdentity(row, { reveal: true })).toBe(row);
  });

  it("leaves all non-identity fields untouched", () => {
    const row = {
      id: "e1",
      title: "Scene",
      body: "long text",
      status: "submitted",
      submitted_at: "2026-01-01T00:00:00Z",
      score: 42,
      metadata: { tags: ["a", "b"], nested: { k: "v" } },
      author_id: OTHER,
    };
    const out = redactIdentity(row) as typeof row;
    expect(out.title).toBe("Scene");
    expect(out.body).toBe("long text");
    expect(out.status).toBe("submitted");
    expect(out.submitted_at).toBe("2026-01-01T00:00:00Z");
    expect(out.score).toBe(42);
    expect(out.metadata).toEqual({ tags: ["a", "b"], nested: { k: "v" } });
    expect(out.author_id).toBeNull();
  });

  it("handles null / undefined / primitive inputs safely", () => {
    expect(redactIdentity(null)).toBeNull();
    expect(redactIdentity(undefined)).toBeUndefined();
    expect(redactIdentity("string" as unknown)).toBe("string");
    expect(redactIdentity(42 as unknown)).toBe(42);
    expect(redactIdentity([] as unknown[])).toEqual([]);
  });

  it("normalizes non-string identity values (numbers, objects) to null", () => {
    const row = {
      id: "e1",
      author_id: 12345 as unknown as string,
      awarded_to: { forged: true } as unknown as string,
    };
    const out = redactIdentity(row) as { author_id: unknown; awarded_to: unknown };
    expect(out.author_id).toBeNull();
    expect(out.awarded_to).toBeNull();
  });

  it("does not mutate the input payload", () => {
    const row = { id: "e1", author_id: OTHER, nested: { awarded_to: THIRD } };
    const snapshot = JSON.parse(JSON.stringify(row));
    redactIdentity(row);
    expect(row).toEqual(snapshot);
  });

  it("returns the same reference when the payload has no identity fields (cheap wrap)", () => {
    const row = { id: "e1", body: "hello", nested: { k: "v" } };
    expect(redactIdentity(row)).toBe(row);
  });

  it("redacts author_id nested inside an award row (award → entry join shape)", () => {
    const row = {
      id: "a1",
      awarded_to: OTHER,
      entry: { id: "e1", author_id: THIRD, body: "line" },
    };
    expect(redactIdentity(row)).toEqual({
      id: "a1",
      awarded_to: null,
      entry: { id: "e1", author_id: null, body: "line" },
    });
  });

  it("redacts across every pre-finalize payload shape the UI consumes", () => {
    // Enumerates every fetch shape from the arena UI audit test.
    const shapes = {
      listArenaSessions: [{ id: "s1", title: "t" }], // no identity — untouched
      listParticipants: [
        { id: "p1", user_id: OTHER, role: "writer" }, // user_id is not an identity field we redact
      ],
      getMyEntry: { id: "e-self", author_id: VIEWER, body: "mine" },
      listVotingEntries: [
        { entry_id: "e1", author_id: OTHER, body: "x" },
        { entry_id: "e2", author_id: THIRD, body: "y" },
        { entry_id: "e3", author_id: VIEWER, body: "mine" },
      ],
      listMyVotes: [{ id: "v1", entry_id: "e1", voter_id: VIEWER }],
      listSessionAwards: [
        { id: "a1", entry_id: "e1", awarded_to: OTHER },
        { id: "a2", entry_id: "e2", awarded_to: THIRD },
      ],
    };
    const out = redactIdentity(shapes, { viewerId: VIEWER });

    // Sessions / participants / votes have no identity leakage surface here.
    expect(out.listArenaSessions).toEqual(shapes.listArenaSessions);
    expect(out.listParticipants).toEqual(shapes.listParticipants);
    expect(out.listMyVotes).toEqual(shapes.listMyVotes);

    // Viewer's own entry preserved.
    expect(out.getMyEntry.author_id).toBe(VIEWER);

    // Voting feed: only viewer's own author_id survives.
    expect(out.listVotingEntries.map((e) => e.author_id)).toEqual([
      null,
      null,
      VIEWER,
    ]);

    // Award feed: everyone else's awarded_to is nulled (no self-award in fixture).
    expect(out.listSessionAwards.every((a) => a.awarded_to === null)).toBe(true);
  });
});
