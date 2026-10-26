import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tiktok/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const back = (msg: string) => Response.redirect(`${url.origin}/ads?tiktok=${encodeURIComponent(msg)}`, 302);
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("auth_code") ?? url.searchParams.get("code") ?? "";
        if (!/^[a-f0-9]{36}$/.test(state) || !code || code.length > 500) return back("erro: link de autorização inválido");
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const key = `tiktok_oauth_state:${state}`;
        const { data: row } = await db.from("integration_secrets").select("value").eq("key", key).maybeSingle();
        await db.from("integration_secrets").delete().eq("key", key);
        if (!row) return back("erro: autorização expirada, tente de novo");
        const st = JSON.parse(row.value) as { name: string; exp: number };
        if (Date.now() > st.exp) return back("erro: autorização expirada, tente de novo");
        try {
          const { exchangeAuthCode, saveBusinessCenter, syncAds } = await import("@/lib/server/tiktok-ads");
          const tok = await exchangeAuthCode(code);
          const { data: bc, error } = await db.from("tiktok_business_centers").insert({ name: st.name }).select("id").single();
          if (error || !bc) throw new Error(error?.message ?? "falha ao salvar BM");
          const n = await saveBusinessCenter(db, bc.id, tok.access_token, (tok.advertiser_ids ?? []).map(String));
          await syncAds(db, { bcId: bc.id, limit: 10 }).catch(() => null);
          return back(`ok: ${n} contas conectadas`);
        } catch (e) {
          const { logSystem } = await import("@/lib/server/ops");
          const msg = e instanceof Error ? e.message : String(e);
          await logSystem(db, { level: "ERROR", source: "tiktok-ads", message: `Conexão de BM falhou: ${msg}` });
          return back(`erro: ${msg.slice(0, 150)}`);
        }
      },
    },
  },
});
