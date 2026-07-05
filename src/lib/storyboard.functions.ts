import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireFeature } from "@/lib/entitlements.functions";
import { z } from "zod";

const Input = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().uuid().optional(),
  prompt: z.string().min(1).max(4000),
  style: z.string().max(200).optional(),
});

// Generate a storyboard panel via Lovable AI image gateway.
// Demo fallback: if image generation fails, store a placeholder gradient SVG so the UI flow stays usable.
export const generateStoryboardPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI not configured");

    await requireFeature(context.supabase, context.userId, "storyboard");

    const { data: p } = await context.supabase.from("projects").select("id").eq("id", data.projectId).maybeSingle();
    if (!p) throw new Error("Project not found");


    const fullPrompt = `${data.prompt}${data.style ? `. Visual style: ${data.style}` : ""}. Cinematic, 16:9, dramatic lighting.`;

    let imageUrl: string | null = null;
    let status = "ok";

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: fullPrompt }],
          modalities: ["image", "text"],
        }),
      });
      if (!res.ok) throw new Error(`Image gateway ${res.status}`);
      const json: any = await res.json();
      const imgB64: string | undefined = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url
        ?? json?.choices?.[0]?.message?.content?.find?.((c: any) => c?.image_url?.url)?.image_url?.url;
      if (!imgB64) throw new Error("No image returned");

      // Upload to storage
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const base64 = imgB64.replace(/^data:image\/\w+;base64,/, "");
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const path = `${context.userId}/${data.projectId}/${crypto.randomUUID()}.png`;
      const up = await supabaseAdmin.storage.from("storyboards").upload(path, bytes, { contentType: "image/png", upsert: false });
      if (up.error) throw up.error;
      const { data: signed } = await supabaseAdmin.storage.from("storyboards").createSignedUrl(path, 60 * 60 * 24 * 365);
      imageUrl = signed?.signedUrl ?? null;
    } catch (err: any) {
      status = "demo";
      imageUrl = `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'>
          <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0' stop-color='%23d4af37'/><stop offset='1' stop-color='%231e2a44'/>
          </linearGradient></defs>
          <rect width='640' height='360' fill='url(%23g)'/>
          <text x='32' y='340' font-family='monospace' font-size='14' fill='white' opacity='0.75'>Demo panel</text>
        </svg>`
      )}`;
    }

    const { data: inserted, error } = await context.supabase.from("storyboard_assets").insert({
      project_id: data.projectId,
      scene_id: data.sceneId ?? null,
      prompt: data.prompt,
      style: data.style ?? null,
      image_url: imageUrl,
      status,
    }).select().single();
    if (error) throw error;
    return inserted;
  });
