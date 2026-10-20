import { createFileRoute } from "@tanstack/react-router";
import { digistoreSignature, digistoreStatus, timingSafeEqualStr } from "@/lib/integrations";

// Digistore24 IPN. Authenticated by a secret token in the URL and, when a passphrase
// is configured, by the sha_sign signature. Replays are dropped via webhook_events.dedupe_key.
export const Route = createFileRoute("/api/public/webhooks/digistore24")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const t0 = Date.now();
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { logSystem, getSecret, rateLimited, enqueueTikTok, processQueue, sha256 } = await import("@/lib/server/ops");
        const endpoint = "/api/public/webhooks/digistore24";
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

        if (await rateLimited(db, `webhook:${ip}`, 60, 120)) return new Response("rate limited", { status: 429 });

        const token = new URL(request.url).searchParams.get("token") ?? "";
        const expected = await getSecret(db, "digistore_webhook_token");
        if (!expected || !timingSafeEqualStr(token, expected)) {
          await logSystem(db, { level: "WARNING", source: "digistore24", message: "Webhook recusado: token inválido", endpoint, status_code: 401 });
          return new Response("unauthorized", { status: 401 });
        }

        const raw = await request.text();
        const params: Record<string, string> = {};
        const ct = request.headers.get("content-type") ?? "";
        try {
          if (ct.includes("json")) Object.assign(params, JSON.parse(raw));
          else new URLSearchParams(raw).forEach((v, k) => (params[k] = v));
        } catch {
          return new Response("bad request", { status: 400 });
        }

        const passphrase = await getSecret(db, "digistore_ipn_passphrase");
        if (passphrase) {
          const sig = params["sha_sign"] ?? params["SHASIGN"] ?? "";
          const calc = await digistoreSignature(params, passphrase);
          if (!timingSafeEqualStr(sig.toUpperCase(), calc)) {
            await logSystem(db, { level: "ERROR", source: "digistore24", message: "Assinatura inválida", endpoint, status_code: 401 });
            return new Response("invalid signature", { status: 401 });
          }
        }

        const event = params["event"] ?? "";
        if (event === "connection_test") {
          await logSystem(db, { level: "INFO", source: "digistore24", message: "Teste de conexão recebido", endpoint, status_code: 200 });
          return new Response("OK");
        }
        const status = digistoreStatus(event);
        const orderId = params["order_id"];
        if (!status || !orderId) {
          await logSystem(db, { level: "INFO", source: "digistore24", message: `Evento ignorado: ${event || "sem evento"}`, endpoint });
          return new Response("OK");
        }

        const txId = params["transaction_id"] ?? "";
        const dedupe = `${orderId}:${txId}:${event}`;
        const { data: fresh } = await db
          .from("webhook_events")
          .upsert({ provider: "digistore24", dedupe_key: dedupe, event_type: event, payload: redact(params) }, { onConflict: "dedupe_key", ignoreDuplicates: true })
          .select("id");
        if (!fresh?.length) {
          await logSystem(db, { level: "INFO", source: "digistore24", message: `Webhook duplicado ignorado (${orderId})`, endpoint });
          return new Response("OK");
        }
        const webhookId = fresh[0]!.id;

        try {
          // Link to the visitor session the tracker passed through ?custom=<session>
          const custom = params["custom"] ?? "";
          const { data: session } = custom
            ? await db.from("sessions").select("*").eq("session_key", custom).maybeSingle()
            : { data: null };

          const amount = Number(params["amount"] ?? params["transaction_amount"] ?? "0") || null;
          const { data: tx, error } = await db
            .from("transactions")
            .upsert(
              {
                provider: "digistore24",
                order_id: orderId,
                transaction_id: txId || null,
                product: params["product_name"] ?? null,
                amount,
                currency: params["currency"] ?? null,
                status,
                funnel_id: session?.funnel_id ?? null,
                session_id: session?.id ?? null,
                visitor_id: session?.visitor_id ?? null,
                campaign: session?.utm_campaign ?? session?.tt_campaign ?? null,
                ttclid: session?.ttclid ?? null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "provider,order_id" },
            )
            .select("id")
            .single();
          if (error || !tx) throw new Error(error?.message ?? "insert failed");

          if (status === "approved" && session) {
            await db.from("sessions").update({ converted: true }).eq("id", session.id);
            await db.from("events").upsert(
              { event_id: `LT_EVT_SALE_${orderId}`, session_id: session.id, funnel_id: session.funnel_id, type: "purchase", url: session.current_url },
              { onConflict: "event_id", ignoreDuplicates: true },
            );
          }

          await logSystem(db, {
            level: "INFO",
            source: "digistore24",
            message: `Venda ${status} recebida — pedido ${orderId}${amount ? ` · ${amount} ${params["currency"] ?? ""}` : ""}`,
            funnel_id: session?.funnel_id,
            session_id: session?.id,
            visitor_id: session?.visitor_id,
            event_name: event,
            endpoint,
            status_code: 200,
            duration_ms: Date.now() - t0,
          });

          // Only confirmed sales become a TikTok conversion. Same event_id as the order → no duplicates.
          if (status === "approved" && session) {
            const email = params["email"] ?? params["buyer_email"];
            const qid = await enqueueTikTok(db, {
              funnel_id: session.funnel_id,
              event_name: "CompletePayment",
              event_id: `LT_EVT_${orderId}`,
              session_id: session.id,
              transaction_id: tx.id,
              payload: {
                event_time: Math.floor(Date.now() / 1000),
                user: { ttclid: session.ttclid ?? undefined, email: email ? await sha256(email) : undefined },
                page: { url: session.current_url ?? undefined },
                properties: { value: amount ?? 0, currency: params["currency"] ?? "EUR", order_id: orderId, content_type: "product" },
              },
            });
            if (qid) await processQueue(db, { ids: [qid] });
          }
          await db.from("webhook_events").update({ status: "processed" }).eq("id", webhookId);
          return new Response("OK");
        } catch (err) {
          const msg = err instanceof Error ? err.message : "erro";
          // Free the dedupe key so Digistore's retry can be processed.
          await db.from("webhook_events").update({ status: "failed", error: msg, dedupe_key: `${dedupe}:failed:${Date.now()}` }).eq("id", webhookId);
          await logSystem(db, { level: "ERROR", source: "digistore24", message: `Falha ao processar venda ${orderId}: ${msg}`, endpoint, status_code: 500 });
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});

function redact(p: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (/sha_sign|password|address|phone|street|zip/i.test(k)) continue;
    out[k] = /email/i.test(k) ? v.replace(/^(.).*(@.*)$/, "$1***$2") : v;
  }
  return out;
}
