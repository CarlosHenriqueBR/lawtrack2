import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        let database = "healthy";
        let queue = "healthy";
        try {
          const { error } = await db.from("funnels").select("id", { head: true, count: "exact" });
          if (error) database = "offline";
          const { count } = await db
            .from("event_queue")
            .select("id", { head: true, count: "exact" })
            .eq("status", "dead_letter");
          if ((count ?? 0) > 0) queue = "warning";
        } catch {
          database = "offline";
        }
        const status = database === "healthy" ? "healthy" : "unhealthy";
        return Response.json({ status, database, queue, realtime: "healthy" }, { status: status === "healthy" ? 200 : 503 });
      },
    },
  },
});
