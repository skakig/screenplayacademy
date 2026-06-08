import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const EventInput = z.object({
  event_type: z.string().min(1).max(64),
  project_id: z.string().uuid().nullable().optional(),
  scene_id: z.string().uuid().nullable().optional(),
  character_id: z.string().uuid().nullable().optional(),
  context: z.record(z.string(), z.any()).optional(),
});

export type WriterEventInput = z.infer<typeof EventInput>;

export const emitWriterEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EventInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("writing_events").insert({
      user_id: context.userId,
      event_type: data.event_type,
      project_id: data.project_id ?? null,
      scene_id: data.scene_id ?? null,
      character_id: data.character_id ?? null,
      context: data.context ?? {},
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
