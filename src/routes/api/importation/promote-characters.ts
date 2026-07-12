import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { promoteApprovedCharactersForDocument } from "@/lib/importation/candidates.functions";

const BodySchema = z.object({
  document_id: z.string().uuid(),
  project_id: z.string().uuid(),
  include_pending: z.boolean().optional().default(false),
});

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

        let payload: z.infer<typeof BodySchema>;
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

        try {
          // The server fn's requireSupabaseAuth middleware reads the same
          // incoming request's Authorization header via getRequest().
          const result = await promoteApprovedCharactersForDocument({
            data: payload,
          });
          return Response.json(result);
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
