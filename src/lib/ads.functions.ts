import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tiktokAuthUrl } from "@/lib/ads";

type Ctx = { supabase: { rpc: (fn: "can_manage", args: { _uid: string }) => PromiseLike<{ data: unknown }> }; userId: string };
async function admin(context: Ctx) {
  const { data } = await context.supabase.rpc("can_manage", { _uid: context.userId });
  if (data !== true) throw new Error("Sem permissão");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Creates the BM row and returns the TikTok authorization URL. */
export const startTikTokConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ name: z.string().trim().min(1).max(120), origin: z.string().url().max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin(context);
    const appId = process.env["TIKTOK_APP_ID"];
    if (!appId || !process.env["TIKTOK_APP_SECRET"]) throw new Error("Cadastre primeiro o App ID e o Secret do app TikTok.");
    const origin = new URL(data.origin).origin;
    const b = new Uint8Array(18);
    crypto.getRandomValues(b);
    const state = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    await db.from("integration_secrets").insert({
      key: `tiktok_oauth_state:${state}`,
      value: JSON.stringify({ uid: context.userId, name: data.name, exp: Date.now() + 15 * 60_000, redirect: `${origin}/api/public/tiktok/callback` }),
    });
    return { url: tiktokAuthUrl(appId, state, `${origin}/api/public/tiktok/callback`) };
  });

export const syncAdsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ bcId: z.string().uuid().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const db = await admin(context);
    const { syncAds } = await import("@/lib/server/tiktok-ads");
    return syncAds(db, { limit: 40, ...(data.bcId ? { bcId: data.bcId } : {}) });
  });

export const deleteBusinessCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin(context);
    await db.from("integration_secrets").delete().eq("key", `tiktok_bc_token:${data.id}`);
    await db.from("tiktok_business_centers").delete().eq("id", data.id);
    return { ok: true };
  });

export const adsSetupStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await admin(context);
    return { appConfigured: !!process.env["TIKTOK_APP_ID"] && !!process.env["TIKTOK_APP_SECRET"] };
  });
