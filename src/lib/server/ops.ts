// Server-only helpers. Callers pass the admin client; never import from components.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { backoffMs, nextFailureState } from "@/lib/integrations";

type DB = SupabaseClient<Database>;
export type Level = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export async function logSystem(
  db: DB,
  e: {
    level: Level;
    source: string;
    message: string;
    funnel_id?: string | null | undefined;
    session_id?: string | null | undefined;
    visitor_id?: string | null | undefined;
    event_name?: string | null | undefined;
    endpoint?: string | null | undefined;
    status_code?: number | null | undefined;
    duration_ms?: number | null | undefined;
    attempt?: number | null | undefined;
    details?: Json | null | undefined;
  },
) {
  try {
    await db.from("system_logs").insert({
      level: e.level,
      source: e.source,
      message: e.message.slice(0, 1000),
      funnel_id: e.funnel_id ?? null,
      session_id: e.session_id ?? null,
      visitor_id: e.visitor_id ?? null,
      event_name: e.event_name ?? null,
      endpoint: e.endpoint ?? null,
      status_code: e.status_code ?? null,
      duration_ms: e.duration_ms ?? null,
      attempt: e.attempt ?? null,
      details: e.details ?? null,
    });
  } catch {
    /* logging must never break the request */
  }
}

export async function rateLimited(db: DB, bucket: string, windowSec: number, max: number) {
  const { data } = await db.rpc("hit_rate_limit", { _bucket: bucket, _window_seconds: windowSec, _max: max });
  return data === false;
}

export async function getSecret(db: DB, key: string) {
  const { data } = await db.from("integration_secrets").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s.trim().toLowerCase()));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export { sha256 };

/** Adds an event to the TikTok queue if the funnel has TikTok enabled. Duplicates are ignored. */
export async function enqueueTikTok(
  db: DB,
  e: {
    funnel_id: string;
    event_name: string;
    event_id: string;
    session_id?: string | null | undefined;
    transaction_id?: string | null | undefined;
    payload: Json;
  },
) {
  const { data: integ } = await db.from("integrations").select("tiktok_enabled").eq("funnel_id", e.funnel_id).maybeSingle();
  if (!integ?.tiktok_enabled) return null;
  const { data } = await db
    .from("event_queue")
    .upsert(
      {
        destination: "tiktok",
        funnel_id: e.funnel_id,
        event_name: e.event_name,
        event_id: e.event_id,
        session_id: e.session_id ?? null,
        transaction_id: e.transaction_id ?? null,
        payload: e.payload,
      },
      { onConflict: "destination,event_name,event_id", ignoreDuplicates: true },
    )
    .select("id");
  return data?.[0]?.id ?? null;
}

const TIKTOK_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

/** Sends due queue items to the TikTok Events API with retry + dead letter. */
export async function processQueue(db: DB, opts: { ids?: string[]; limit?: number } = {}) {
  let q = db
    .from("event_queue")
    .select("*, funnels(tiktok_pixel_id, integrations(tiktok_test_mode, tiktok_test_event_code))")
    .in("status", ["pending", "retry", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at")
    .limit(opts.limit ?? 50);
  if (opts.ids?.length) q = q.in("id", opts.ids);
  const { data: items } = await q;
  if (!items?.length) return { processed: 0 };

  const token = await getSecret(db, "tiktok_access_token");
  let ok = 0;
  for (const it of items) {
    // claim the item so parallel runs don't double-send
    const { data: claimed } = await db
      .from("event_queue")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", it.id)
      .in("status", ["pending", "retry", "failed"])
      .select("id");
    if (!claimed?.length) continue;

    const attempts = it.attempts + 1;
    const pixel = it.funnels?.tiktok_pixel_id;
    const integ = Array.isArray(it.funnels?.integrations) ? it.funnels?.integrations[0] : it.funnels?.integrations;
    const fail = async (msg: string, code: number | null, level: Level = "ERROR") => {
      const state = !token || !pixel ? "failed" : nextFailureState(attempts);
      await db
        .from("event_queue")
        .update({
          status: state,
          attempts,
          last_error: msg.slice(0, 500),
          last_status_code: code,
          next_attempt_at: new Date(Date.now() + backoffMs(attempts)).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", it.id);
      await logSystem(db, {
        level: state === "dead_letter" ? "CRITICAL" : level,
        source: "tiktok",
        message: `${it.event_name} falhou${state === "dead_letter" ? " (dead letter)" : ""}: ${msg}`,
        funnel_id: it.funnel_id,
        session_id: it.session_id,
        event_name: it.event_name,
        endpoint: TIKTOK_URL,
        status_code: code,
        attempt: attempts,
      });
    };

    if (!token) {
      await fail("Access Token do TikTok não configurado", null, "WARNING");
      continue;
    }
    if (!pixel) {
      await fail("Pixel ID não configurado no funil", null, "WARNING");
      continue;
    }
    const body: Record<string, unknown> = {
      event_source: "web",
      event_source_id: pixel,
      data: [{ ...(it.payload as Record<string, unknown>), event: it.event_name, event_id: it.event_id }],
    };
    if (integ?.tiktok_test_mode && integ.tiktok_test_event_code) body["test_event_code"] = integ.tiktok_test_event_code;

    const t0 = Date.now();
    try {
      const res = await fetch(TIKTOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Access-Token": token },
        body: JSON.stringify(body),
      });
      const txt = await res.text();
      let code: number | null = null;
      let msg = txt;
      try {
        const j = JSON.parse(txt) as { code?: number; message?: string };
        code = j.code ?? null;
        msg = j.message ?? txt;
      } catch {
        /* non-json */
      }
      if (res.ok && (code === 0 || code === null)) {
        ok++;
        await db
          .from("event_queue")
          .update({ status: "success", attempts, last_status_code: res.status, last_error: null, updated_at: new Date().toISOString() })
          .eq("id", it.id);
        await logSystem(db, {
          level: "INFO",
          source: "tiktok",
          message: `${it.event_name} enviado ao TikTok — ${res.status} OK`,
          funnel_id: it.funnel_id,
          session_id: it.session_id,
          event_name: it.event_name,
          endpoint: TIKTOK_URL,
          status_code: res.status,
          duration_ms: Date.now() - t0,
          attempt: attempts,
        });
      } else {
        await fail(`HTTP ${res.status} ${msg}`.slice(0, 300), res.status);
      }
    } catch (err) {
      await fail(err instanceof Error ? err.message : "erro de rede", null);
    }
  }
  return { processed: items.length, ok };
}
