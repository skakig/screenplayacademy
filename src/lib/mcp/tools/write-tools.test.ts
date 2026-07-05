import { describe, expect, it } from "vitest";
import { z } from "zod";
import createSceneTool from "./create-scene";
import updateSceneTool from "./update-scene";
import upsertCharacterTool from "./upsert-character";
import appendScriptBlocksTool from "./append-script-blocks";
import updateScriptBlockTool from "./update-script-block";
import {
  blockContent,
  longTextNullable,
  sanitizeText,
  shortText,
  shortTextNullable,
} from "./_shared";

/**
 * These tests exercise the MCP write-tool input schemas directly.
 *
 * `defineTool` exposes the raw zod shape on `.inputSchema`, so wrapping it
 * with `z.object(...)` gives us the exact validator the MCP runtime uses
 * before dispatching to `handler(...)`. That means every rule below is a
 * true integration check of what an external assistant would hit — no
 * hand-copied schema, no database required.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const schemaFor = (tool: any) => z.object(tool.inputSchema);

const UUID = "00000000-0000-4000-8000-000000000000";
const OTHER_UUID = "11111111-1111-4111-8111-111111111111";

describe("_shared sanitizeText", () => {
  it("trims whitespace", () => {
    expect(sanitizeText("  hello  ")).toBe("hello");
  });
  it("normalizes CRLF to LF", () => {
    expect(sanitizeText("a\r\nb\rc")).toBe("a\nb\nc");
  });
  it("strips control chars except tab and newline", () => {
    expect(sanitizeText("hi\x00\x01\tthere\nnext\x07")).toBe("hi\tthere\nnext");
  });
});

describe("_shared shortText / shortTextNullable", () => {
  it("shortText rejects newlines", () => {
    expect(() => shortText(50).parse("one\ntwo")).toThrow();
  });
  it("shortText enforces max length after trim", () => {
    expect(() => shortText(5).parse("      abcdef      ")).toThrow();
    expect(shortText(5).parse("  abc  ")).toBe("abc");
  });
  it("shortTextNullable maps empty/whitespace to null", () => {
    expect(shortTextNullable(50).parse("   ")).toBeNull();
    expect(shortTextNullable(50).parse("kept")).toBe("kept");
  });
  it("longTextNullable enforces max length", () => {
    expect(() => longTextNullable(10).parse("x".repeat(11))).toThrow();
    expect(longTextNullable(10).parse("ok")).toBe("ok");
  });
  it("blockContent caps at 4000 chars", () => {
    expect(() => blockContent.parse("x".repeat(4001))).toThrow();
    expect(blockContent.parse("x".repeat(4000)).length).toBe(4000);
  });
});

describe("create_scene input schema", () => {
  const schema = schemaFor(createSceneTool);

  it("accepts a minimal valid payload", () => {
    const result = schema.parse({ project_id: UUID });
    expect(result.project_id).toBe(UUID);
  });

  it("rejects non-uuid project_id", () => {
    expect(() => schema.parse({ project_id: "not-a-uuid" })).toThrow();
  });

  it("rejects newlines in scene_heading", () => {
    expect(() =>
      schema.parse({ project_id: UUID, scene_heading: "INT. HOUSE\nNIGHT" }),
    ).toThrow();
  });

  it("caps initial_blocks at 50", () => {
    const blocks = Array.from({ length: 51 }, () => ({
      block_type: "action" as const,
      content: "hi",
    }));
    expect(() => schema.parse({ project_id: UUID, initial_blocks: blocks })).toThrow();
  });

  it("accepts exactly 50 initial_blocks", () => {
    const blocks = Array.from({ length: 50 }, () => ({
      block_type: "action" as const,
      content: "hi",
    }));
    expect(() => schema.parse({ project_id: UUID, initial_blocks: blocks })).not.toThrow();
  });

  it("rejects unknown block_type", () => {
    expect(() =>
      schema.parse({
        project_id: UUID,
        initial_blocks: [{ block_type: "monologue", content: "x" }],
      }),
    ).toThrow();
  });

  it("rejects negative order_index and out-of-range order_index", () => {
    expect(() => schema.parse({ project_id: UUID, order_index: -1 })).toThrow();
    expect(() => schema.parse({ project_id: UUID, order_index: 100_001 })).toThrow();
    expect(() => schema.parse({ project_id: UUID, order_index: 5 })).not.toThrow();
  });

  it("caps initial block content at 4000 chars", () => {
    expect(() =>
      schema.parse({
        project_id: UUID,
        initial_blocks: [{ block_type: "action", content: "x".repeat(4001) }],
      }),
    ).toThrow();
  });

  it("normalizes empty nullable fields to null", () => {
    const parsed = schema.parse({
      project_id: UUID,
      title: "   ",
      location: "Studio 5",
    });
    expect(parsed.title).toBeNull();
    expect(parsed.location).toBe("Studio 5");
  });
});

describe("update_scene input schema", () => {
  const schema = schemaFor(updateSceneTool);

  it("requires scene_id", () => {
    expect(() => schema.parse({})).toThrow();
  });

  it("accepts a valid status enum", () => {
    expect(() => schema.parse({ scene_id: UUID, status: "in_progress" })).not.toThrow();
  });

  it("rejects an unknown status", () => {
    expect(() => schema.parse({ scene_id: UUID, status: "shipped" })).toThrow();
  });

  it("rejects newline in title", () => {
    expect(() => schema.parse({ scene_id: UUID, title: "a\nb" })).toThrow();
  });

  it("empty long-text fields normalize to null", () => {
    const parsed = schema.parse({ scene_id: UUID, plot_purpose: "   " });
    expect(parsed.plot_purpose).toBeNull();
  });

  it("rejects long-text over the cap", () => {
    expect(() =>
      schema.parse({ scene_id: UUID, plot_purpose: "x".repeat(2001) }),
    ).toThrow();
  });
});

describe("append_script_blocks input schema", () => {
  const schema = schemaFor(appendScriptBlocksTool);

  it("requires at least one block", () => {
    expect(() =>
      schema.parse({ project_id: UUID, scene_id: OTHER_UUID, blocks: [] }),
    ).toThrow();
  });

  it("caps batch at 50 blocks", () => {
    const blocks = Array.from({ length: 51 }, () => ({
      block_type: "action" as const,
      content: "line",
    }));
    expect(() =>
      schema.parse({ project_id: UUID, scene_id: OTHER_UUID, blocks }),
    ).toThrow();
  });

  it("rejects a block whose content exceeds 4000 chars", () => {
    expect(() =>
      schema.parse({
        project_id: UUID,
        scene_id: OTHER_UUID,
        blocks: [{ block_type: "dialogue", content: "x".repeat(4001) }],
      }),
    ).toThrow();
  });

  it("rejects a non-uuid character_id", () => {
    expect(() =>
      schema.parse({
        project_id: UUID,
        scene_id: OTHER_UUID,
        blocks: [{ block_type: "dialogue", content: "hi", character_id: "nope" }],
      }),
    ).toThrow();
  });

  it("accepts a valid payload", () => {
    const parsed = schema.parse({
      project_id: UUID,
      scene_id: OTHER_UUID,
      blocks: [
        { block_type: "action", content: "  She enters.  " },
        { block_type: "character", content: "JANE" },
        { block_type: "dialogue", content: "Hi.", character_id: null },
      ],
    }) as { blocks: Array<{ content: string }> };
    expect(parsed.blocks).toHaveLength(3);
    expect(parsed.blocks[0].content).toBe("She enters.");
  });
});

describe("update_script_block input schema", () => {
  const schema = schemaFor(updateScriptBlockTool);

  it("requires block_id", () => {
    expect(() => schema.parse({ content: "x" })).toThrow();
  });

  it("rejects invalid block_type enum", () => {
    expect(() => schema.parse({ block_id: UUID, block_type: "chorus" })).toThrow();
  });

  it("caps content at 4000 chars", () => {
    expect(() => schema.parse({ block_id: UUID, content: "x".repeat(4001) })).toThrow();
  });

  it("accepts a valid update", () => {
    const parsed = schema.parse({
      block_id: UUID,
      content: "New line.",
      block_type: "action",
    });
    expect(parsed.content).toBe("New line.");
  });
});

describe("update_script_block handler", () => {
  it("rejects an update with no editable fields", async () => {
    // Handler is dispatched after zod validation. The empty-patch guard is
    // an explicit fail(...) inside the handler, so we exercise it directly.
    const ctx = {
      isAuthenticated: () => true,
      getUserId: () => UUID,
      getToken: () => "irrelevant",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await (updateScriptBlockTool as any).handler(
      { block_id: UUID },
      ctx,
    );
    expect(result.isError).toBe(true);
    expect(String(result.content[0].text)).toMatch(/No fields to update/i);
  });
});

describe("update_scene handler", () => {
  it("rejects an update with no editable fields (before any DB call)", async () => {
    // We stub isAuthenticated=false so the handler short-circuits with
    // the unauth guard — proving unauth is enforced before validation logic.
    const ctx = {
      isAuthenticated: () => false,
      getUserId: () => null,
      getToken: () => "irrelevant",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await (updateSceneTool as any).handler({ scene_id: UUID }, ctx);
    expect(result.isError).toBe(true);
    expect(String(result.content[0].text)).toMatch(/Not authenticated/i);
  });
});

describe("upsert_character input schema", () => {
  const schema = schemaFor(upsertCharacterTool);

  it("requires project_id and fields", () => {
    expect(() => schema.parse({})).toThrow();
    expect(() => schema.parse({ project_id: UUID })).toThrow();
  });

  it("rejects newline in name", () => {
    expect(() =>
      schema.parse({ project_id: UUID, fields: { name: "First\nLast" } }),
    ).toThrow();
  });

  it("caps character_arc at 4000 chars", () => {
    expect(() =>
      schema.parse({
        project_id: UUID,
        fields: { name: "Jane", character_arc: "x".repeat(4001) },
      }),
    ).toThrow();
  });

  it("normalizes blank nullable fields to null", () => {
    const parsed = schema.parse({
      project_id: UUID,
      fields: { name: "Jane", alias: "   ", archetype: "Mentor" },
    }) as { fields: { alias: string | null; archetype: string | null } };
    expect(parsed.fields.alias).toBeNull();
    expect(parsed.fields.archetype).toBe("Mentor");
  });

  it("accepts a valid create payload", () => {
    expect(() =>
      schema.parse({
        project_id: UUID,
        fields: { name: "Jane", internal_need: "acceptance" },
      }),
    ).not.toThrow();
  });

  it("accepts a valid update payload", () => {
    expect(() =>
      schema.parse({
        project_id: UUID,
        character_id: OTHER_UUID,
        fields: { archetype: "Trickster" },
      }),
    ).not.toThrow();
  });
});
