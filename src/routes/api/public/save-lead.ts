import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isTransactionEmailFor } from "@/lib/lead";

const optionalUtm = z.string().max(200).nullable();
const LeadBody = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    transactionEmail: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    leadKey: z.string().regex(/^L[a-f0-9]{32}$/),
    sessionKey: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,80}$/)
      .nullable(),
    utms: z
      .object({
        utm_source: optionalUtm,
        utm_medium: optionalUtm,
        utm_campaign: optionalUtm,
        utm_content: optionalUtm,
        utm_term: optionalUtm,
      })
      .strict(),
  })
  .strict()
  .superRefine(({ email, transactionEmail }, ctx) => {
    if (!isTransactionEmailFor(email, transactionEmail)) {
      ctx.addIssue({
        code: "custom",
        path: ["transactionEmail"],
        message: "invalid transaction email",
      });
    }
  });

const json = (body: unknown, status = 200) => Response.json(body, { status });

export const Route = createFileRoute("/api/public/save-lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = JSON.parse(await request.text());
        } catch {
          return json({ error: "invalid_json" }, 400);
        }

        const parsed = LeadBody.safeParse(payload);
        if (!parsed.success) return json({ error: "invalid_payload" }, 400);

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { rateLimited } = await import("@/lib/server/ops");
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (await rateLimited(db, `save-lead:${ip}`, 60, 30))
          return json({ error: "rate_limited" }, 429);

        const { email, transactionEmail, leadKey, sessionKey, utms } = parsed.data;
        const { data: inserted, error } = await db
          .from("checkout_leads")
          .upsert(
            {
              email,
              transaction_email: transactionEmail,
              lead_key: leadKey,
              session_key: sessionKey,
              utm_source: utms.utm_source,
              utm_medium: utms.utm_medium,
              utm_campaign: utms.utm_campaign,
              utm_content: utms.utm_content,
              utm_term: utms.utm_term,
            },
            { onConflict: "lead_key", ignoreDuplicates: true },
          )
          .select("id")
          .maybeSingle();

        if (error) {
          console.error("[save-lead] Could not store checkout lead:", error.message);
          return json(
            { error: error.code === "23505" ? "transaction_email_conflict" : "lead_save_failed" },
            error.code === "23505" ? 409 : 500,
          );
        }
        if (inserted) return json({ ok: true });

        const { data: existingByKey, error: keyLookupError } = await db
          .from("checkout_leads")
          .select("email, transaction_email")
          .eq("lead_key", leadKey)
          .maybeSingle();
        if (keyLookupError) {
          console.error("[save-lead] Could not verify existing lead:", keyLookupError.message);
          return json({ error: "lead_save_failed" }, 500);
        }
        if (existingByKey?.email === email && existingByKey.transaction_email === transactionEmail)
          return json({ ok: true });

        const { data: existingByEmail, error: emailLookupError } = await db
          .from("checkout_leads")
          .select("id")
          .eq("transaction_email", transactionEmail)
          .maybeSingle();
        if (emailLookupError) {
          console.error("[save-lead] Could not check transaction email:", emailLookupError.message);
          return json({ error: "lead_save_failed" }, 500);
        }
        if (existingByEmail) return json({ error: "transaction_email_conflict" }, 409);
        return json({ error: "lead_key_conflict" }, 409);
      },
    },
  },
});
