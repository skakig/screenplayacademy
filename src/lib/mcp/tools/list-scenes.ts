import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function userClient(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_scenes",
  title: "List scenes in a project",
  description:
    "List all scenes for a given screenplay project, in order. Returns id, scene_heading, location, time_of_day, title, status, and order_index.",
  inputSchema: {
    project_id: z.string().uuid().describe("The project's UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = userClient(ctx);
    const { data, error } = await supabase
      .from("scenes")
      .select("id, scene_heading, title, location, time_of_day, status, order_index, emotional_purpose, plot_purpose, conflict")
      .eq("project_id", project_id)
      .order("order_index", { ascending: true });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { scenes: data ?? [] },
    };
  },
});
