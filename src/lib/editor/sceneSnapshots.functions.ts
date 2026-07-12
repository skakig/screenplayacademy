// Pass B — Scene-level revision snapshots.
// Server functions to capture, list, rename, restore, and delete scene snapshots.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SceneSnapshotBlock = {
  id?: string;
  block_type: string;
  content: string;
  order_index: number;
  character_id?: string | null;
  metadata?: Record<string, any> | null;
};

export type SceneSnapshotPayload = {
  scene: {
    id: string;
    title: string | null;
    scene_heading: string | null;
    location: string | null;
    time_of_day: string | null;
  };
  blocks: SceneSnapshotBlock[];
};

export type SceneSnapshotRow = {
  id: string;
  project_id: string;
  scene_id: string;
  label: string | null;
  summary: string | null;
  block_count: number;
  word_count: number;
  created_at: string;
  updated_at: string;
};

function wordCount(blocks: SceneSnapshotBlock[]): number {
  let n = 0;
  for (const b of blocks) {
    const t = (b.content ?? "").trim();
    if (!t) continue;
    n += t.split(/\s+/).length;
  }
  return n;
}

export const captureSceneSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        project_id: z.string().uuid(),
        scene_id: z.string().uuid(),
        label: z.string().trim().max(120).optional(),
        summary: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: scene, error: sceneErr } = await supabase
      .from("scenes")
      .select("id, project_id, title, scene_heading, location, time_of_day")
      .eq("id", data.scene_id)
      .eq("project_id", data.project_id)
      .maybeSingle();
    if (sceneErr) throw new Error(sceneErr.message);
    if (!scene) throw new Error("Scene not found");

    const { data: blocks, error: blocksErr } = await supabase
      .from("script_blocks")
      .select("id, block_type, content, order_index, character_id, metadata")
      .eq("scene_id", data.scene_id)
      .eq("project_id", data.project_id)
      .order("order_index", { ascending: true });
    if (blocksErr) throw new Error(blocksErr.message);

    const payload: SceneSnapshotPayload = {
      scene: {
        id: scene.id,
        title: scene.title,
        scene_heading: scene.scene_heading,
        location: scene.location,
        time_of_day: scene.time_of_day,
      },
      blocks: (blocks ?? []) as SceneSnapshotBlock[],
    };

    const label =
      data.label && data.label.length > 0
        ? data.label
        : `Snapshot ${new Date().toLocaleString()}`;

    const { data: row, error: insErr } = await supabase
      .from("scene_snapshots")
      .insert({
        project_id: data.project_id,
        scene_id: data.scene_id,
        user_id: userId,
        label,
        summary: data.summary ?? null,
        block_count: payload.blocks.length,
        word_count: wordCount(payload.blocks),
        snapshot: payload as any,
      })
      .select("id, project_id, scene_id, label, summary, block_count, word_count, created_at, updated_at")
      .single();
    if (insErr) throw new Error(insErr.message);
    return row as SceneSnapshotRow;
  });

export const listSceneSnapshots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ project_id: z.string().uuid(), scene_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("scene_snapshots")
      .select("id, project_id, scene_id, label, summary, block_count, word_count, created_at, updated_at")
      .eq("project_id", data.project_id)
      .eq("scene_id", data.scene_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as SceneSnapshotRow[];
  });

export const getSceneSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ snapshot_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("scene_snapshots")
      .select(
        "id, project_id, scene_id, label, summary, block_count, word_count, created_at, updated_at, snapshot",
      )
      .eq("id", data.snapshot_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Snapshot not found");
    return row as unknown as SceneSnapshotRow & { snapshot: SceneSnapshotPayload };
  });


export const renameSceneSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        snapshot_id: z.string().uuid(),
        label: z.string().trim().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("scene_snapshots")
      .update({ label: data.label })
      .eq("id", data.snapshot_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteSceneSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ snapshot_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("scene_snapshots")
      .delete()
      .eq("id", data.snapshot_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const restoreSceneSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        snapshot_id: z.string().uuid(),
        // If true, capture the current scene as a snapshot before overwriting.
        capture_current: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: snap, error: snapErr } = await supabase
      .from("scene_snapshots")
      .select("id, project_id, scene_id, label, snapshot")
      .eq("id", data.snapshot_id)
      .maybeSingle();
    if (snapErr) throw new Error(snapErr.message);
    if (!snap) throw new Error("Snapshot not found");

    const payload = snap.snapshot as unknown as SceneSnapshotPayload;
    if (!payload || !Array.isArray(payload.blocks)) {
      throw new Error("Snapshot payload is invalid");
    }

    // Optional pre-restore capture so restores are reversible.
    if (data.capture_current) {
      const { data: currentBlocks } = await supabase
        .from("script_blocks")
        .select("id, block_type, content, order_index, character_id, metadata")
        .eq("scene_id", snap.scene_id)
        .eq("project_id", snap.project_id)
        .order("order_index", { ascending: true });
      const { data: scene } = await supabase
        .from("scenes")
        .select("id, title, scene_heading, location, time_of_day")
        .eq("id", snap.scene_id)
        .maybeSingle();
      if (scene) {
        const backup: SceneSnapshotPayload = {
          scene: {
            id: scene.id,
            title: scene.title,
            scene_heading: scene.scene_heading,
            location: scene.location,
            time_of_day: scene.time_of_day,
          },
          blocks: (currentBlocks ?? []) as SceneSnapshotBlock[],
        };
        await supabase.from("scene_snapshots").insert({
          project_id: snap.project_id,
          scene_id: snap.scene_id,
          user_id: userId,
          label: `Before restore — ${new Date().toLocaleString()}`,
          summary: `Auto-captured before restoring "${snap.label ?? "snapshot"}"`,
          block_count: backup.blocks.length,
          word_count: wordCount(backup.blocks),
          snapshot: backup as any,
        });
      }
    }

    // Replace scene blocks with snapshot contents.
    const { error: delErr } = await supabase
      .from("script_blocks")
      .delete()
      .eq("scene_id", snap.scene_id)
      .eq("project_id", snap.project_id);
    if (delErr) throw new Error(delErr.message);

    if (payload.blocks.length > 0) {
      const rows = payload.blocks.map((b, i) => ({
        project_id: snap.project_id,
        scene_id: snap.scene_id,
        block_type: b.block_type,
        content: b.content ?? "",
        order_index: typeof b.order_index === "number" ? b.order_index : i,
        character_id: b.character_id ?? null,
        metadata: (b.metadata ?? {}) as any,
        updated_by: userId,
      }));
      const { error: insErr } = await supabase.from("script_blocks").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    return { ok: true as const, scene_id: snap.scene_id };
  });
