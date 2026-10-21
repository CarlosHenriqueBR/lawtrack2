import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { embedCaptureSchema, embedLeadKey, embedSlug } from "./embed-capture";
import { leadCheckoutUrl } from "./lead";
import { resolveCaptureAppearance } from "./capture-appearance";

export const getEmbedAppearance = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slug: embedSlug }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await db.from("checkout_links").select("capture_appearance").eq("slug", data.slug).eq("enabled", true).maybeSingle();
    if (error || !link) throw new Error("Checkout indisponível.");
    return resolveCaptureAppearance(link.capture_appearance);
  });

export const saveEmbedLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => embedCaptureSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const request = getRequest();
    const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? "unknown";
    const { data: allowed, error: limitError } = await db.rpc("hit_rate_limit", { _bucket: `embed-lead:${ip}`, _window_seconds: 60, _max: 30 });
    if (limitError || allowed !== true) throw new Error("Aguarde um minuto e tente novamente.");
    const { data: link, error: linkError } = await db.from("checkout_links").select("id").eq("slug", data.slug).eq("enabled", true).maybeSingle();
    if (linkError || !link) throw new Error("Checkout indisponível.");
    const leadKey = `L${crypto.randomUUID().replaceAll("-", "")}`;
    // Legacy unique column holds an internal identifier only; NEVER send this to the provider.
    const { error } = await db.from("checkout_leads").insert({
      email: data.email,
      transaction_email: `${leadKey.toLowerCase()}@lead.invalid`,
      lead_key: leadKey,
      session_key: data.sessionKey,
      ...data.utms,
    });
    if (error) throw new Error("Não foi possível salvar seu email. Tente novamente.");
    return { leadKey };
  });

export const resolveEmbedPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slug: embedSlug, leadKey: embedLeadKey }).strict().parse(input))
  .handler(async ({ data }) => {
    // The unguessable lead key is a capability for this submitted email, not a list/read API.
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [linkResult, leadResult] = await Promise.all([
      db.from("checkout_links").select("product_id").eq("slug", data.slug).eq("enabled", true).maybeSingle(),
      db.from("checkout_leads").select("email, created_at, transaction_email").eq("lead_key", data.leadKey).maybeSingle(),
    ]);
    const lead = leadResult.data;
    if (linkResult.error || leadResult.error || !linkResult.data || !lead || lead.transaction_email !== `${data.leadKey.toLowerCase()}@lead.invalid` || Date.now() - Date.parse(lead.created_at) > 30 * 60 * 1000) {
      throw new Error("Este acesso expirou. Informe seu email novamente.");
    }
    return { url: leadCheckoutUrl(linkResult.data.product_id, lead.email, data.leadKey) };
  });