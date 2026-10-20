import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { matchStep, parseUserAgent } from "@/lib/tracking";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const s = (n: number) => z.string().max(n).optional().nullable();
const Body = z.object({
  funnel_id: z.string().uuid(),
  visitor_id: z.string().min(6).max(64).regex(/^[A-Za-z0-9_-]+$/),
  session_key: z.string().min(6).max(64).regex(/^[A-Za-z0-9_-]+$/),
  event_id: z.string().min(6).max(64).regex(/^[A-Za-z0-9_-]+$/),
  type: z.enum(["page_view", "heartbeat", "leave"]),
  url: z.string().url().max(2000),
  referrer: s(2000),
  language: s(20),
  screen: s(20),
  returning: z.boolean().optional(),
  utm_source: s(200),
  utm_medium: s(200),
  utm_campaign: s(200),
  utm_content: s(200),
  utm_term: s(200),
  ttclid: s(300),
  tt_campaign: s(200),
  tt_adset: s(200),
  tt_ad: s(200),
});

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = Body.safeParse(JSON.parse(await request.text()));
        } catch {
          return json({ error: "invalid json" }, 400);
        }
        if (!parsed.success) return json({ error: "invalid payload" }, 400);
        const d = parsed.data;

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

        const { data: funnel } = await db
          .from("funnels")
          .select("id, status, funnel_steps(id, url_pattern, step_order)")
          .eq("id", d.funnel_id)
          .maybeSingle();
        if (!funnel || funnel.status !== "active") return json({ error: "unknown funnel" }, 404);

        const steps = funnel.funnel_steps ?? [];
        const lastOrder = steps.reduce((m, x) => Math.max(m, x.step_order), 0);
        const now = new Date().toISOString();

        const { data: existing } = await db
          .from("sessions")
          .select("id, funnel_id, max_step_order, current_url, page_views, converted")
          .eq("session_key", d.session_key)
          .maybeSingle();
        if (existing && existing.funnel_id !== d.funnel_id) return json({ error: "session mismatch" }, 409);

        if (d.type !== "page_view") {
          if (existing) {
            // "leave" backdates last_seen so the visitor drops off the live view quickly.
            const lastSeen = d.type === "leave" ? new Date(Date.now() - 50_000).toISOString() : now;
            await db.from("sessions").update({ last_seen_at: lastSeen }).eq("id", existing.id);
          }
          return json({ ok: true });
        }

        const step = matchStep(d.url, steps);
        let sessionId = existing?.id;

        if (!existing) {
          const ua = parseUserAgent(request.headers.get("user-agent") ?? "");
          const cf = (request as unknown as { cf?: Record<string, string> }).cf ?? {};
          const { data: created, error } = await db
            .from("sessions")
            .insert({
              session_key: d.session_key,
              visitor_id: d.visitor_id,
              funnel_id: d.funnel_id,
              is_returning: !!d.returning,
              current_step_id: step?.id ?? null,
              max_step_order: step?.step_order ?? 0,
              current_url: d.url,
              page_views: 1,
              country: request.headers.get("cf-ipcountry") ?? cf["country"] ?? null,
              region: cf["region"] ?? null,
              city: cf["city"] ?? null,
              ...ua,
              language: d.language,
              screen: d.screen,
              referrer: d.referrer,
              landing_url: d.url,
              utm_source: d.utm_source,
              utm_medium: d.utm_medium,
              utm_campaign: d.utm_campaign,
              utm_content: d.utm_content,
              utm_term: d.utm_term,
              ttclid: d.ttclid,
              tt_campaign: d.tt_campaign ?? d.utm_campaign,
              tt_adset: d.tt_adset,
              tt_ad: d.tt_ad ?? d.utm_content,
              converted: !!step && step.step_order === lastOrder,
            })
            .select("id")
            .single();
          if (error || !created) return json({ error: "could not create session" }, 500);
          sessionId = created.id;
        } else {
          await db
            .from("sessions")
            .update({
              previous_url: existing.current_url,
              current_url: d.url,
              current_step_id: step?.id ?? null,
              max_step_order: Math.max(existing.max_step_order, step?.step_order ?? 0),
              page_views: existing.page_views + 1,
              converted: existing.converted || (!!step && step.step_order === lastOrder),
              last_seen_at: now,
            })
            .eq("id", existing.id);
        }

        // event_id is unique: a retried request is ignored instead of counted twice.
        await db.from("events").upsert(
          {
            event_id: d.event_id,
            session_id: sessionId!,
            funnel_id: d.funnel_id,
            step_id: step?.id ?? null,
            type: "page_view",
            url: d.url,
          },
          { onConflict: "event_id", ignoreDuplicates: true },
        );

        return json({ ok: true, step: step?.step_order ?? null });
      },
    },
  },
});
