// Pure ad-spend / ROI math shared by the ads page and tests.

export type AdAccount = { advertiser_id: string; bc_id: string; name: string | null; currency: string; enabled: boolean; domains: string[] };
export type CampaignStat = {
  advertiser_id: string;
  campaign_id: string;
  campaign_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
};
export type Sale = {
  amount: number | null;
  currency: string | null;
  tt_campaign?: string | null | undefined;
  utm_campaign?: string | null | undefined;
  landing_url?: string | null | undefined;
};
export type Rates = Record<string, number>; // currency -> value of 1 unit in BRL

export function toBrl(value: number, currency: string | null | undefined, rates: Rates): number | null {
  const c = (currency || "BRL").toUpperCase();
  const r = rates[c];
  return r === undefined ? null : value * r;
}

export function hostOf(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeDomain(d: string) {
  const t = d.trim().toLowerCase();
  return (hostOf(t.includes("://") ? t : `https://${t}`) ?? "").replace(/^www\./, "");
}

/** Finds the ad account that generated a sale: campaign id/name first, then unique domain. */
export function attributeSale(sale: Sale, stats: CampaignStat[], accounts: AdAccount[]): { advertiser_id: string; campaign_id: string | null } | null {
  const keys = [sale.tt_campaign, sale.utm_campaign].filter((k): k is string => !!k?.trim()).map((k) => k.trim().toLowerCase());
  for (const k of keys) {
    const hit = stats.find((s) => s.campaign_id.toLowerCase() === k) ?? stats.find((s) => (s.campaign_name ?? "").trim().toLowerCase() === k);
    if (hit) return { advertiser_id: hit.advertiser_id, campaign_id: hit.campaign_id };
  }
  const host = hostOf(sale.landing_url);
  if (host) {
    const owners = accounts.filter((a) => a.domains.some((d) => normalizeDomain(d) === host));
    if (owners.length === 1) return { advertiser_id: owners[0]!.advertiser_id, campaign_id: null };
  }
  return null;
}

export type Metrics = {
  spend: number;
  revenue: number;
  sales: number;
  profit: number;
  roi: number | null;
  roas: number | null;
  cpa: number | null;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
};
export type Status = "lucro" | "prejuizo" | "sem_venda" | "sem_gasto";

export function finish(m: Pick<Metrics, "spend" | "revenue" | "sales" | "impressions" | "clicks" | "conversions">): Metrics {
  const profit = m.revenue - m.spend;
  return {
    ...m,
    profit,
    roi: m.spend > 0 ? profit / m.spend : null,
    roas: m.spend > 0 ? m.revenue / m.spend : null,
    cpa: m.sales > 0 ? m.spend / m.sales : null,
    ctr: m.impressions > 0 ? m.clicks / m.impressions : null,
    cpc: m.clicks > 0 ? m.spend / m.clicks : null,
    cpm: m.impressions > 0 ? (m.spend / m.impressions) * 1000 : null,
  };
}

export function statusOf(m: Metrics): Status {
  if (m.spend <= 0 && m.sales === 0) return "sem_gasto";
  if (m.sales === 0) return "sem_venda";
  return m.profit >= 0 ? "lucro" : "prejuizo";
}

const empty = () => ({ spend: 0, revenue: 0, sales: 0, impressions: 0, clicks: 0, conversions: 0 });

/** Aggregates spend (in BRL) and attributed sales per account and per campaign. */
export function summarize(accounts: AdAccount[], stats: CampaignStat[], sales: Sale[], rates: Rates) {
  const acc = new Map(accounts.map((a) => [a.advertiser_id, { account: a, ...empty() }]));
  const camp = new Map<string, { advertiser_id: string; campaign_id: string; name: string | null } & ReturnType<typeof empty>>();
  let fxMissing = 0;
  let unattributed = 0;
  for (const s of stats) {
    const a = acc.get(s.advertiser_id);
    if (!a) continue;
    const spend = toBrl(s.spend, a.account.currency, rates);
    if (spend === null) fxMissing++;
    const key = `${s.advertiser_id}:${s.campaign_id}`;
    const c = camp.get(key) ?? { advertiser_id: s.advertiser_id, campaign_id: s.campaign_id, name: s.campaign_name, ...empty() };
    for (const t of [a, c]) {
      t.spend += spend ?? 0;
      t.impressions += s.impressions;
      t.clicks += s.clicks;
      t.conversions += s.conversions;
    }
    if (s.campaign_name) c.name = s.campaign_name;
    camp.set(key, c);
  }
  for (const sale of sales) {
    const hit = attributeSale(sale, stats, accounts);
    const a = hit && acc.get(hit.advertiser_id);
    if (!hit || !a) {
      unattributed++;
      continue;
    }
    const rev = toBrl(Number(sale.amount ?? 0), sale.currency, rates);
    if (rev === null) fxMissing++;
    a.sales++;
    a.revenue += rev ?? 0;
    const c = hit.campaign_id ? camp.get(`${hit.advertiser_id}:${hit.campaign_id}`) : undefined;
    if (c) {
      c.sales++;
      c.revenue += rev ?? 0;
    }
  }
  const accountRows = [...acc.values()].map(({ account, ...m }) => ({ account, ...finish(m) }));
  const campaignRows = [...camp.values()].map(({ advertiser_id, campaign_id, name, ...m }) => ({ advertiser_id, campaign_id, name, ...finish(m) }));
  const total = finish(accountRows.reduce((t, r) => ({ spend: t.spend + r.spend, revenue: t.revenue + r.revenue, sales: t.sales + r.sales, impressions: t.impressions + r.impressions, clicks: t.clicks + r.clicks, conversions: t.conversions + r.conversions }), empty()));
  return { accounts: accountRows, campaigns: campaignRows, total, fxMissing, unattributed };
}

export function tiktokAuthUrl(appId: string, state: string, redirectUri: string) {
  const q = new URLSearchParams({ app_id: appId, state, redirect_uri: redirectUri });
  return `https://business-api.tiktok.com/portal/auth?${q}`;
}

export type DiscoveredAccount = { advertiser_id: string; name: string | null };

/** Accounts a BM token can read that the platform does not know yet: deduped, blank ids dropped. */
export function newAccounts(found: DiscoveredAccount[], knownIds: Iterable<string>): DiscoveredAccount[] {
  const known = new Set(knownIds);
  const seen = new Set<string>();
  const out: DiscoveredAccount[] = [];
  for (const f of found) {
    const id = String(f.advertiser_id ?? "").trim();
    if (!id || known.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ advertiser_id: id, name: f.name?.trim() || null });
  }
  return out;
}
