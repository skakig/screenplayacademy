/**
 * MCP write-tool RLS integration tests.
 *
 * These tests hit a REAL Supabase project. They create two disposable auth
 * users, seed a project owned by User A, then verify that:
 *   1. User B is refused by RLS on every MCP write tool that targets A's data
 *   2. User A can perform the same operations successfully
 *
 * They are OFF by default because they create real auth records. Run them
 * explicitly with:
 *   MCP_RLS_INTEGRATION=1 bunx vitest run src/lib/mcp/tools/write-tools.rls.test.ts
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import appendScriptBlocksTool from "./append-script-blocks";
import createSceneTool from "./create-scene";
import updateSceneTool from "./update-scene";
import updateScriptBlockTool from "./update-script-block";
import upsertCharacterTool from "./upsert-character";

const ENABLED =
  process.env.MCP_RLS_INTEGRATION === "1" &&
  !!process.env.SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.SUPABASE_PUBLISHABLE_KEY;

// Mock ToolContext shape — matches what @lovable.dev/mcp-js passes to a handler.
type Ctx = {
  isAuthenticated: () => boolean;
  getUserId: () => string;
  getToken: () => string;
};
const ctxFor = (userId: string, token: string): Ctx => ({
  isAuthenticated: () => true,
  getUserId: () => userId,
  getToken: () => token,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (tool: any, input: unknown, ctx: Ctx) => tool.handler(input, ctx);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isErr = (r: any) => r?.isError === true;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const okData = <T = any>(r: any, key: string): T => {
  expect(r.isError, `expected success, got: ${JSON.stringify(r)}`).not.toBe(true);
  return r.structuredContent[key] as T;
};

describe.skipIf(!ENABLED)("MCP write tools — Supabase RLS integration", () => {
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const userA = { email: `mcp-rls-a-${runId}@scenesmith.test`, password: `pw-${runId}-A!` };
  const userB = { email: `mcp-rls-b-${runId}@scenesmith.test`, password: `pw-${runId}-B!` };

  let admin: SupabaseClient;
  let userAId = "";
  let userBId = "";
  let userAToken = "";
  let userBToken = "";
  let projectId = "";
  let sceneId = "";
  let blockId = "";
  let characterId = "";

  beforeAll(async () => {
    admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // 1. Create two auth users with email confirmed so we can sign in.
    const { data: a, error: aErr } = await admin.auth.admin.createUser({
      email: userA.email,
      password: userA.password,
      email_confirm: true,
    });
    if (aErr || !a.user) throw aErr ?? new Error("createUser A failed");
    userAId = a.user.id;

    const { data: b, error: bErr } = await admin.auth.admin.createUser({
      email: userB.email,
      password: userB.password,
      email_confirm: true,
    });
    if (bErr || !b.user) throw bErr ?? new Error("createUser B failed");
    userBId = b.user.id;

    // 2. Mint access tokens for each user by signing in with the publishable key.
    const anon = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: signA, error: signAErr } = await anon.auth.signInWithPassword(userA);
    if (signAErr || !signA.session) throw signAErr ?? new Error("sign-in A failed");
    userAToken = signA.session.access_token;

    const { data: signB, error: signBErr } = await anon.auth.signInWithPassword(userB);
    if (signBErr || !signB.session) throw signBErr ?? new Error("sign-in B failed");
    userBToken = signB.session.access_token;

    // 3. Seed one project + one scene + one character + one block owned by User A
    //    via the admin client (bypasses RLS to guarantee seed state).
    const { data: proj, error: projErr } = await admin
      .from("projects")
      .insert({ user_id: userAId, title: `RLS test ${runId}` })
      .select("id")
      .single();
    if (projErr || !proj) throw projErr ?? new Error("project seed failed");
    projectId = proj.id;

    const { data: scene, error: sceneErr } = await admin
      .from("scenes")
      .insert({ project_id: projectId, order_index: 0, status: "draft" })
      .select("id")
      .single();
    if (sceneErr || !scene) throw sceneErr ?? new Error("scene seed failed");
    sceneId = scene.id;

    const { data: block, error: blockErr } = await admin
      .from("script_blocks")
      .insert({
        project_id: projectId,
        scene_id: sceneId,
        block_type: "action",
        content: "Seed line owned by A.",
        order_index: 0,
      })
      .select("id")
      .single();
    if (blockErr || !block) throw blockErr ?? new Error("block seed failed");
    blockId = block.id;

    const { data: character, error: charErr } = await admin
      .from("characters")
      .insert({ project_id: projectId, name: "Seed Character" })
      .select("id")
      .single();
    if (charErr || !character) throw charErr ?? new Error("character seed failed");
    characterId = character.id;
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    if (projectId) {
      // Cascade cleanup: scenes/characters/script_blocks reference projects.
      await admin.from("script_blocks").delete().eq("project_id", projectId);
      await admin.from("characters").delete().eq("project_id", projectId);
      await admin.from("scenes").delete().eq("project_id", projectId);
      await admin.from("projects").delete().eq("id", projectId);
    }
    if (userAId) await admin.auth.admin.deleteUser(userAId).catch(() => {});
    if (userBId) await admin.auth.admin.deleteUser(userBId).catch(() => {});
  }, 60_000);

  // ---------- Non-owner (User B) is blocked ----------

  describe("non-owner (User B) is blocked by RLS", () => {
    it("cannot create a scene in User A's project", async () => {
      const r = await call(
        createSceneTool,
        { project_id: projectId, scene_heading: "INT. HIJACK - NIGHT" },
        ctxFor(userBId, userBToken),
      );
      expect(isErr(r)).toBe(true);
    });

    it("cannot update User A's scene", async () => {
      const r = await call(
        updateSceneTool,
        { scene_id: sceneId, title: "Hijacked" },
        ctxFor(userBId, userBToken),
      );
      expect(isErr(r)).toBe(true);

      // Confirm nothing changed on disk.
      const { data } = await admin.from("scenes").select("title").eq("id", sceneId).single();
      expect(data?.title ?? null).not.toBe("Hijacked");
    });

    it("cannot append script blocks to User A's scene", async () => {
      const r = await call(
        appendScriptBlocksTool,
        {
          project_id: projectId,
          scene_id: sceneId,
          blocks: [{ block_type: "action", content: "Injected line." }],
        },
        ctxFor(userBId, userBToken),
      );
      expect(isErr(r)).toBe(true);

      const { count } = await admin
        .from("script_blocks")
        .select("id", { count: "exact", head: true })
        .eq("scene_id", sceneId)
        .eq("content", "Injected line.");
      expect(count ?? 0).toBe(0);
    });

    it("cannot update User A's script block", async () => {
      const r = await call(
        updateScriptBlockTool,
        { block_id: blockId, content: "Hijacked content." },
        ctxFor(userBId, userBToken),
      );
      expect(isErr(r)).toBe(true);

      const { data } = await admin
        .from("script_blocks")
        .select("content")
        .eq("id", blockId)
        .single();
      expect(data?.content).toBe("Seed line owned by A.");
    });

    it("cannot upsert (create) a character in User A's project", async () => {
      const r = await call(
        upsertCharacterTool,
        { project_id: projectId, fields: { name: "Impostor" } },
        ctxFor(userBId, userBToken),
      );
      expect(isErr(r)).toBe(true);

      const { count } = await admin
        .from("characters")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("name", "Impostor");
      expect(count ?? 0).toBe(0);
    });

    it("cannot upsert (update) User A's character", async () => {
      const r = await call(
        upsertCharacterTool,
        {
          project_id: projectId,
          character_id: characterId,
          fields: { archetype: "Hijacked" },
        },
        ctxFor(userBId, userBToken),
      );
      expect(isErr(r)).toBe(true);

      const { data } = await admin
        .from("characters")
        .select("archetype")
        .eq("id", characterId)
        .single();
      expect(data?.archetype ?? null).not.toBe("Hijacked");
    });
  });

  // ---------- Owner (User A) succeeds on the same operations ----------

  describe("owner (User A) succeeds on the same operations", () => {
    it("updates their own scene", async () => {
      const r = await call(
        updateSceneTool,
        { scene_id: sceneId, title: "Owner update" },
        ctxFor(userAId, userAToken),
      );
      const scene = okData<{ title: string }>(r, "scene");
      expect(scene.title).toBe("Owner update");
    });

    it("appends script blocks to their own scene", async () => {
      const r = await call(
        appendScriptBlocksTool,
        {
          project_id: projectId,
          scene_id: sceneId,
          blocks: [{ block_type: "action", content: "Owner append." }],
        },
        ctxFor(userAId, userAToken),
      );
      const blocks = okData<Array<{ content: string }>>(r, "blocks");
      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toBe("Owner append.");
    });

    it("updates their own script block", async () => {
      const r = await call(
        updateScriptBlockTool,
        { block_id: blockId, content: "Owner rewrite." },
        ctxFor(userAId, userAToken),
      );
      const block = okData<{ content: string }>(r, "block");
      expect(block.content).toBe("Owner rewrite.");
    });

    it("creates a character in their own project", async () => {
      const r = await call(
        upsertCharacterTool,
        { project_id: projectId, fields: { name: "Owner Character" } },
        ctxFor(userAId, userAToken),
      );
      const character = okData<{ id: string; name: string }>(r, "character");
      expect(character.name).toBe("Owner Character");

      // Cleanup this ad-hoc row so afterAll's project cascade stays tidy.
      await admin.from("characters").delete().eq("id", character.id);
    });

    it("creates a scene in their own project", async () => {
      const r = await call(
        createSceneTool,
        { project_id: projectId, scene_heading: "INT. OWNER SCENE - DAY" },
        ctxFor(userAId, userAToken),
      );
      const scene = okData<{ id: string; scene_heading: string }>(r, "scene");
      expect(scene.scene_heading).toBe("INT. OWNER SCENE - DAY");
      await admin.from("scenes").delete().eq("id", scene.id);
    });
  });
});

describe.skipIf(ENABLED)("MCP write tools — RLS integration (skipped)", () => {
  it("is disabled without MCP_RLS_INTEGRATION=1 + Supabase env", () => {
    // Placeholder so vitest reports the file as executed when disabled.
    expect(true).toBe(true);
  });
});
