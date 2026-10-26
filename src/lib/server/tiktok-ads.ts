// Server-only: TikTok Marketing API sync. Callers pass the admin client.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { newAccounts } from "@/lib/ads";
import { getSecret, logSystem } from "./ops";

type DB = SupabaseClient<Database>;
const API = "https://business-api.tiktok.com/open_api/v1.3";

type Envelope<T> = { code: number; message: string; data: T };

async function call<T>(path: string, token: string | null, init: { query?: Record<string, string>; body?: unknown } = {}): Promise<T> {
  const url = `${API}${path}${init.query ? `?${new URLSearchParams(init.query)}` : ""}`;
  const res = await fetch(url, {
    method: init.body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { "Access-Token": token } : {}) },
    body: init.body ? JSON.stringify(init.body) : null,
  });
  const txt = await res.text();
  let j: Envelope<T>;
  try {
    j = JSON.parse(txt) as Envelope<T>;
  } catch {
    throw new Error(`TikTok HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  if (!res.ok || j.code !== 0) throw new Error(`TikTok ${res.status}/${j.code}: ${j.message}`);
  return j.data;
}

export async function exchangeAuthCode(authCode: string) {
  const app_id = process.env["TIKTOK_APP_ID"];
  const secret = process.env["TIKTOK_APP_SECRET"];
  if (!app_id || !secret) throw new Error("TIKTOK_APP_ID/TIKTOK_APP_SECRET não configurados");
  return call<{ access_token: string; advertiser_ids: string[] }>("/oauth2/access_token/", null, { body: { app_id, secret, auth_code: authCode } });
}

export async function advertiserInfo(token: string, ids: string[]) {
  const out: { advertiser_id: string; name?: string; currency?: string; timezone?: string }[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const d = await call<{ list: typeof out }>("/advertiser/info/", token, {
      query: { advertiser_ids: JSON.stringify(ids.slice(i, i + 100)), fields: JSON.stringify(["name", "currency", "timezone"]) },
    });
    out.push(...(d.list ?? []));
  }
  return out;
}

/** Saves the BM token and upserts every advertiser it can read. */
export async function saveBusinessCenter(db: DB, bcId: string, token: string, advertiserIds: string[]) {
  await db.from("integration_secrets").upsert({ key: `tiktok_bc_token:${bcId}`, value: token, updated_at: new Date().toISOString() });
  const info = await advertiserInfo(token, advertiserIds);
  const rows = advertiserIds.map((id) => {
    const i = info.find((x) => String(x.advertiser_id) === id);
    return { advertiser_id: id, bc_id: bcId, name: i?.name ?? null, currency: i?.currency ?? "USD", timezone: i?.timezone ?? null };
  });
  if (rows.length) await db.from("tiktok_ad_accounts").upsert(rows, { onConflict: "advertiser_id" });
  return rows.length;
}

/** Re-lists every account the token can still read, so accounts added to the BM later show up by themselves. */
export async function discoverAdvertisers(token: string) {
  const app_id = process.env["TIKTOK_APP_ID"];
  const secret = process.env["TIKTOK_APP_SECRET"];
  if (!app_id || !secret) throw new Error("TIKTOK_APP_ID/TIKTOK_APP_SECRET não configurados");
  const d = await call<{ list: { advertiser_id: string; advertiser_name?: string }[] }>("/oauth2/advertiser/get/", token, { query: { app_id, secret } });
  return (d.list ?? []).map((x) => ({ advertiser_id: String(x.advertiser_id), name: x.advertiser_name ?? null }));
}

/** Registers the accounts a BM gained since it was connected. */
async function discoverForBc(db: DB, bcId: string, token: string) {
  try {
    const found = await discoverAdvertisers(token);
    const { data: known } = await db.from("tiktok_ad_accounts").select("advertiser_id");
    const fresh = newAccounts(found, (known ?? []).map((k) => k.advertiser_id));
    if (!fresh.length) return 0;
    const info = await advertiserInfo(token, fresh.map((f) => f.advertiser_id));
    await db.from("tiktok_ad_accounts").upsert(
      fresh.map((f) => {
        const i = info.find((x) => String(x.advertiser_id) === f.advertiser_id);
        return { advertiser_id: f.advertiser_id, bc_id: bcId, name: f.name ?? i?.name ?? null, currency: i?.currency ?? "USD", timezone: i?.timezone ?? null };
      }),
      { onConflict: "advertiser_id" },
    );
    await logSystem(db, { level: "INFO", source: "tiktok-ads", message: `${fresh.length} conta(s) nova(s) na BM ${bcId}` });
    return fresh.length;
  } catch (e) {
    await logSystem(db, { level: "WARNING", source: "tiktok-ads", message: `Busca de contas novas falhou: ${e instanceof Error ? e.message : String(e)}` });
    return 0;
  }
}

const day = (d: Date) => d.toISOString().slice(0, 10);

type ReportRow = { dimensions: { campaign_id: string; stat_time_day: string }; metrics: Record<string, string> };

async function syncAccount(db: DB, token: string, advertiserId: string, firstSync: boolean) {
  const end = new Date();
  const start = new Date(Date.now() - (firstSync ? 29 : 2) * 86_400_000);
  const rows: Database["public"]["Tables"]["tiktok_campaign_stats"]["Insert"][] = [];
  for (let page = 1; page <= 20; page++) {
    const d = await call<{ list: ReportRow[]; page_info: { total_page: number } }>("/report/integrated/get/", token, {
      query: {
        advertiser_id: advertiserId,
        report_type: "BASIC",
        data_level: "AUCTION_CAMPAIGN",
        dimensions: JSON.stringify(["campaign_id", "stat_time_day"]),
        metrics: JSON.stringify(["campaign_name", "spend", "impressions", "clicks", "conversion"]),
        start_date: day(start),
        end_date: day(end),
        page: String(page),
        page_size: "1000",
      },
    });
    for (const r of d.list ?? []) {
      rows.push({
        advertiser_id: advertiserId,
        campaign_id: String(r.dimensions.campaign_id),
        stat_date: r.dimensions.stat_time_day.slice(0, 10),
        campaign_name: r.metrics["campaign_name"] ?? null,
        spend: Number(r.metrics["spend"] ?? 0) || 0,
        impressions: Math.round(Number(r.metrics["impressions"] ?? 0) || 0),
        clicks: Math.round(Number(r.metrics["clicks"] ?? 0) || 0),
        conversions: Number(r.metrics["conversion"] ?? 0) || 0,
        updated_at: new Date().toISOString(),
      });
    }
    if (page >= (d.page_info?.total_page ?? 1)) break;
  }
  if (rows.length) {
    const { error } = await db.from("tiktok_campaign_stats").upsert(rows, { onConflict: "advertiser_id,campaign_id,stat_date" });
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

export async function refreshFx(db: DB) {
  const { data } = await db.from("fx_rates").select("updated_at").neq("currency", "BRL").order("updated_at").limit(1);
  const oldest = data?.[0]?.updated_at;
  if (oldest && Date.now() - new Date(oldest).getTime() < 12 * 3600_000) return;
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=BRL");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as { rates: Record<string, number> };
    const now = new Date().toISOString();
    const rows = Object.entries(j.rates).filter(([, v]) => v > 0).map(([currency, v]) => ({ currency, rate_to_brl: 1 / v, updated_at: now }));
    await db.from("fx_rates").upsert([{ currency: "BRL", rate_to_brl: 1, updated_at: now }, ...rows]);
  } catch (e) {
    await logSystem(db, { level: "WARNING", source: "fx", message: `Cotação não atualizada: ${e instanceof Error ? e.message : e}` });
  }
}

/** Syncs the stalest enabled accounts (bounded batch, limited parallelism), registering accounts the BMs gained. */
export async function syncAds(db: DB, opts: { limit?: number; bcId?: string } = {}) {
  await refreshFx(db);
  const tokens = new Map<string, string | null>();
  let discovered = 0;
  let bq = db.from("tiktok_business_centers").select("id");
  if (opts.bcId) bq = bq.eq("id", opts.bcId);
  const { data: bcs } = await bq;
  for (const bc of bcs ?? []) {
    const token = await getSecret(db, `tiktok_bc_token:${bc.id}`);
    tokens.set(bc.id, token);
    if (token) discovered += await discoverForBc(db, bc.id, token);
  }
  let q = db.from("tiktok_ad_accounts").select("advertiser_id, bc_id, last_sync_at").eq("enabled", true).order("last_sync_at", { ascending: true, nullsFirst: true }).limit(opts.limit ?? 40);
  if (opts.bcId) q = q.eq("bc_id", opts.bcId);
  const { data: accounts } = await q;
  if (!accounts?.length) return { synced: 0, failed: 0, discovered };
  for (const a of accounts) if (!tokens.has(a.bc_id)) tokens.set(a.bc_id, await getSecret(db, `tiktok_bc_token:${a.bc_id}`));
  let synced = 0;
  let failed = 0;
  const work = [...accounts];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let a = work.shift(); a; a = work.shift()) {
        const token = tokens.get(a.bc_id);
        const now = new Date().toISOString();
        try {
          if (!token) throw new Error("BM sem token — conecte novamente");
          await syncAccount(db, token, a.advertiser_id, !a.last_sync_at);
          await db.from("tiktok_ad_accounts").update({ last_sync_at: now, last_error: null }).eq("advertiser_id", a.advertiser_id);
          synced++;
        } catch (e) {
          failed++;
          const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
          await db.from("tiktok_ad_accounts").update({ last_sync_at: now, last_error: msg }).eq("advertiser_id", a.advertiser_id);
          await logSystem(db, { level: "ERROR", source: "tiktok-ads", message: `Conta ${a.advertiser_id}: ${msg}` });
        }
      }
    }),
  );
  for (const bc of tokens.keys()) await db.from("tiktok_business_centers").update({ last_sync_at: new Date().toISOString() }).eq("id", bc);
  return { synced, failed, discovered };
}
