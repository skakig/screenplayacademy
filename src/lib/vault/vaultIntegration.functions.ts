import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { VaultSceneRow } from "./schemas";

const DESTINATIONS = ["act_1", "act_2a", "midpoint", "act_2b", "act_3", "custom"] as const;

const Input = z.object({
  vaultSceneId: z.string().uuid(),
  destination: z.enum(DESTINATIONS),
  referenceSceneId: z.string().uuid().optional().nullable(),
  position: z.enum(["before", "after"]).default("after"),
});

function deriveHeading(v: VaultSceneRow): string {
  if (v.location) {
    const time = v.emotional_tone ? "" : "";
    return `INT. ${v.location.toUpperCase()}${time ? ` - ${time}` : ""}`;
  }
  return v.title.toUpperCase();
}

/**
 * Integrate a Vault scene into the timeline (Copy + link).
 * - Creates a new `scenes` row at the chosen order_index.
 * - Sets `scenes.source_vault_scene_id = vault.id`.
 * - Seeds one `script_blocks` action block from vault content.
 * - Updates the vault row: status='integrated', linked_scene_id=<new scene>.
 * - Never overwrites any existing scene.
 */
export const integrateVaultScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: vault, error: vErr } = await context.supabase
      .from("vault_scenes")
      .select("*")
      .eq("id", data.vaultSceneId)
      .single();
    if (vErr || !vault) throw new Error(vErr?.message ?? "Vault scene not found");
    const v = vault as VaultSceneRow;

    // Existing scenes for the project
    const { data: scenes, error: sErr } = await context.supabase
      .from("scenes")
      .select("id, order_index")
      .eq("project_id", v.project_id)
      .order("order_index", { ascending: true });
    if (sErr) throw new Error(sErr.message);
    const list = (scenes ?? []) as { id: string; order_index: number }[];

    // Compute target position
    let targetIndex = list.length; // append by default
    if (data.destination === "custom" && data.referenceSceneId) {
      const idx = list.findIndex((s) => s.id === data.referenceSceneId);
      if (idx < 0) throw new Error("Reference scene not found");
      targetIndex = data.position === "before" ? idx : idx + 1;
    } else if (data.destination !== "custom") {
      // Distribute across acts by fraction of list length
      const total = Math.max(list.length, 1);
      const fractions: Record<string, number> = {
        act_1: 0.15,
        act_2a: 0.35,
        midpoint: 0.5,
        act_2b: 0.65,
        act_3: 0.85,
      };
      targetIndex = Math.round(total * (fractions[data.destination] ?? 1));
    }
    targetIndex = Math.max(0, Math.min(targetIndex, list.length));

    // Shift later scenes' order_index +1 (in reverse to avoid unique conflicts if any).
    const toShift = list.slice(targetIndex);
    for (let i = toShift.length - 1; i >= 0; i--) {
      const s = toShift[i];
      const { error } = await context.supabase
        .from("scenes")
        .update({ order_index: s.order_index + 1 })
        .eq("id", s.id);
      if (error) throw new Error(error.message);
    }

    const heading = deriveHeading(v);
    const { data: newScene, error: nsErr } = await context.supabase
      .from("scenes")
      .insert({
        project_id: v.project_id,
        title: v.title,
        scene_heading: heading,
        location: v.location,
        order_index: targetIndex,
        status: "draft",
        source_vault_scene_id: v.id,
        emotional_purpose: v.emotional_tone,
      })
      .select("*")
      .single();
    if (nsErr || !newScene) throw new Error(nsErr?.message ?? "Could not create scene");

    // Seed a scene heading + action block from vault content
    const sceneId = (newScene as { id: string }).id;
    const blocks = [
      {
        project_id: v.project_id,
        scene_id: sceneId,
        block_type: "scene_heading",
        content: heading,
        order_index: 0,
      },
      ...(v.content.trim().length > 0
        ? [
            {
              project_id: v.project_id,
              scene_id: sceneId,
              block_type: "action",
              content: v.content.trim(),
              order_index: 1,
            },
          ]
        : []),
    ];
    const { error: bErr } = await context.supabase.from("script_blocks").insert(blocks);
    if (bErr) throw new Error(bErr.message);

    // Mark vault row integrated + link
    const { error: uErr } = await context.supabase
      .from("vault_scenes")
      .update({
        status: "integrated",
        linked_scene_id: (newScene as { id: string }).id,
      })
      .eq("id", v.id);
    if (uErr) throw new Error(uErr.message);

    return { sceneId: (newScene as { id: string }).id, orderIndex: targetIndex };
  });
