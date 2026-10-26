import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, downloadCsv } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { periodRange, type Period } from "@/lib/data";
import { normalizeDomain, statusOf, summarize, type Metrics, type Status } from "@/lib/ads";
import { adsSetupStatus, deleteBusinessCenter, startTikTokConnect, syncAdsNow } from "@/lib/ads.functions";

export const Route = createFileRoute("/_authenticated/ads")({
  head: () => ({
    meta: [
      { title: "Contas TikTok — Lawtrack" },
      { name: "description", content: "Gasto, vendas, lucro e ROI por conta de anúncio do TikTok." },
      { property: "og:title", content: "Contas TikTok — Lawtrack" },
      { property: "og:description", content: "Gasto, vendas, lucro e ROI por conta de anúncio do TikTok." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Ads,
});

const brl = (n: number | null) => (n === null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);
const STATUS: Record<Status, { l: string; c: string }> = {
  lucro: { l: "Lucro", c: "text-success" },
  prejuizo: { l: "Prejuízo", c: "text-destructive" },
  sem_venda: { l: "Sem venda", c: "text-muted-foreground" },
  sem_gasto: { l: "Parada", c: "text-muted-foreground" },
};
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Ads() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("today");
  const [bc, setBc] = useState("");
  const [filter, setFilter] = useState<Status | "">("");
  const [openAcc, setOpenAcc] = useState<string | null>(null);
  const [from, to] = periodRange(period);
  const sync = useServerFn(syncAdsNow);

  useEffect(() => {
    const msg = new URLSearchParams(window.location.search).get("tiktok");
    if (msg) {
      (msg.startsWith("ok") ? toast.success : toast.error)(msg.replace(/^(ok|erro): /, ""));
      window.history.replaceState(null, "", "/ads");
    }
  }, []);

  const base = useQuery({
    queryKey: ["ads-base"],
    queryFn: async () => {
      const [b, a, f] = await Promise.all([
        supabase.from("tiktok_business_centers").select("*").order("created_at"),
        supabase.from("tiktok_ad_accounts").select("*").order("name"),
        supabase.from("fx_rates").select("currency, rate_to_brl"),
      ]);
      return { bcs: b.data ?? [], accounts: a.data ?? [], rates: Object.fromEntries((f.data ?? []).map((r) => [r.currency, Number(r.rate_to_brl)])) };
    },
  });

  const data = useQuery({
    queryKey: ["ads-data", period],
    refetchInterval: 60_000,
    queryFn: async () => {
      const toDay = new Date(to.getTime() - 1);
      const [st, tx] = await Promise.all([
        supabase.from("tiktok_campaign_stats").select("*").gte("stat_date", localDay(from)).lte("stat_date", localDay(toDay)).limit(20000),
        supabase.from("transactions").select("amount, currency, session_id, campaign").eq("status", "approved").gte("occurred_at", from.toISOString()).lt("occurred_at", to.toISOString()).limit(10000),
      ]);
      const txs = tx.data ?? [];
      const ids = [...new Set(txs.map((t) => t.session_id).filter((x): x is string => !!x))];
      const sess = new Map<string, { tt_campaign: string | null; utm_campaign: string | null; landing_url: string | null }>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data: s } = await supabase.from("sessions").select("id, tt_campaign, utm_campaign, landing_url").in("id", ids.slice(i, i + 200));
        s?.forEach((r) => sess.set(r.id, r));
      }
      const sales = txs.map((t) => {
        const s = t.session_id ? sess.get(t.session_id) : undefined;
        return { amount: t.amount, currency: t.currency, tt_campaign: s?.tt_campaign ?? t.campaign, utm_campaign: s?.utm_campaign, landing_url: s?.landing_url };
      });
      return { stats: (st.data ?? []).map((r) => ({ ...r, spend: Number(r.spend), conversions: Number(r.conversions) })), sales };
    },
  });

  const accounts = useMemo(() => (base.data?.accounts ?? []).filter((a) => a.enabled && (!bc || a.bc_id === bc)), [base.data, bc]);
  const sum = useMemo(() => summarize(accounts, data.data?.stats ?? [], data.data?.sales ?? [], base.data?.rates ?? { BRL: 1 }), [accounts, data.data, base.data]);
  const rows = sum.accounts.filter((r) => !filter || statusOf(r) === filter).sort((a, b) => b.spend - a.spend);
  const bcName = (id: string) => base.data?.bcs.find((b) => b.id === id)?.name ?? "";
  const t = sum.total;

  async function syncNow() {
    try {
      const r = await sync({ data: bc ? { bcId: bc } : {} });
      toast.success(`${r.synced} contas atualizadas${r.failed ? `, ${r.failed} com erro` : ""}${r.discovered ? `, ${r.discovered} conta(s) nova(s)` : ""}`);
      qc.invalidateQueries({ queryKey: ["ads-base"] });
      qc.invalidateQueries({ queryKey: ["ads-data"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao sincronizar");
    }
  }

  const cards = [
    { l: "Gasto", v: brl(t.spend) },
    { l: "Receita", v: brl(t.revenue) },
    { l: t.profit >= 0 ? "Lucro" : "Prejuízo", v: brl(t.profit), c: t.profit >= 0 ? "text-success" : "text-destructive" },
    { l: "ROI", v: pct(t.roi) },
    { l: "ROAS", v: t.roas === null ? "—" : `${t.roas.toFixed(2)}x` },
    { l: "Vendas", v: t.sales.toLocaleString("pt-BR") },
    { l: "CPA", v: brl(t.cpa) },
    { l: "CTR / CPM", v: `${pct(t.ctr)} · ${brl(t.cpm)}` },
  ];
  const sel = "rounded-md border bg-card px-3 py-1.5";

  return (
    <div>
      <PageHeader title="Contas TikTok" sub="Valores convertidos para reais (R$)">
        <div className="flex flex-wrap gap-2">
          <select className={sel} value={bc} onChange={(e) => setBc(e.target.value)}>
            <option value="">Todas as BMs</option>
            {base.data?.bcs.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select className={sel} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="today">Hoje</option>
            <option value="yesterday">Ontem</option>
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
          </select>
          <Button variant="outline" onClick={syncNow}>Atualizar agora</Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.l} className="panel p-4">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{c.l}</div>
            <div className={`mt-2 font-display text-3xl ${c.c ?? ""}`}>{c.v}</div>
          </div>
        ))}
      </div>
      {(sum.unattributed > 0 || sum.fxMissing > 0) && (
        <p className="mt-3 text-muted-foreground">
          {sum.unattributed > 0 && `${sum.unattributed} venda(s) sem conta identificada (campanha fora do link). `}
          {sum.fxMissing > 0 && "Alguns valores estão em moeda sem cotação e ficaram de fora."}
        </p>
      )}

      <div className="mb-3 mt-8 flex flex-wrap items-center gap-1">
        {([["", "Todas"], ["lucro", "Dando ROI"], ["prejuizo", "Prejuízo"], ["sem_venda", "Gastando sem vender"], ["sem_gasto", "Paradas"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-sm px-3 py-1 ${filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {l}
          </button>
        ))}
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => downloadCsv("contas-tiktok.csv", rows.map((r) => ({ bm: bcName(r.account.bc_id), conta: r.account.name ?? r.account.advertiser_id, id: r.account.advertiser_id, gasto: r.spend.toFixed(2), receita: r.revenue.toFixed(2), lucro: r.profit.toFixed(2), roi: r.roi === null ? "" : (r.roi * 100).toFixed(1), vendas: r.sales, cpa: r.cpa?.toFixed(2) ?? "" })))}>
          Exportar CSV
        </Button>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>{["Conta", "BM", "Status", "Gasto", "Receita", "Lucro", "ROI", "ROAS", "Vendas", "CPA", "CTR", "CPC"].map((h) => <th key={h} className="px-3 py-3 font-normal">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">{accounts.length ? "Sem dados no período." : "Nenhuma conta conectada ainda."}</td></tr>
            )}
            {rows.map((r) => (
              <AccountRow key={r.account.advertiser_id} r={r} bm={bcName(r.account.bc_id)} open={openAcc === r.account.advertiser_id} onToggle={() => setOpenAcc(openAcc === r.account.advertiser_id ? null : r.account.advertiser_id)} campaigns={sum.campaigns.filter((c) => c.advertiser_id === r.account.advertiser_id)} />
            ))}
          </tbody>
        </table>
      </div>

      <Setup />
    </div>
  );
}

function Cells({ m }: { m: Metrics }) {
  return (
    <>
      <td className="px-3 py-2.5 tabular-nums">{brl(m.spend)}</td>
      <td className="px-3 py-2.5 tabular-nums">{brl(m.revenue)}</td>
      <td className={`px-3 py-2.5 tabular-nums ${m.profit >= 0 ? "text-success" : "text-destructive"}`}>{brl(m.profit)}</td>
      <td className="px-3 py-2.5 tabular-nums">{pct(m.roi)}</td>
      <td className="px-3 py-2.5 tabular-nums">{m.roas === null ? "—" : `${m.roas.toFixed(2)}x`}</td>
      <td className="px-3 py-2.5 tabular-nums">{m.sales}</td>
      <td className="px-3 py-2.5 tabular-nums">{brl(m.cpa)}</td>
      <td className="px-3 py-2.5 tabular-nums">{pct(m.ctr)}</td>
      <td className="px-3 py-2.5 tabular-nums">{brl(m.cpc)}</td>
    </>
  );
}

function AccountRow({ r, bm, open, onToggle, campaigns }: { r: Metrics & { account: { advertiser_id: string; name: string | null; last_error?: string | null } }; bm: string; open: boolean; onToggle: () => void; campaigns: (Metrics & { campaign_id: string; name: string | null })[] }) {
  const s = STATUS[statusOf(r)];
  return (
    <>
      <tr className="cursor-pointer border-b hover:bg-muted/40" onClick={onToggle}>
        <td className="px-3 py-2.5">{r.account.name ?? r.account.advertiser_id}<div className="text-[11px] text-muted-foreground">{r.account.advertiser_id}</div></td>
        <td className="px-3 py-2.5 text-muted-foreground">{bm}</td>
        <td className={`px-3 py-2.5 ${s.c}`}>{s.l}</td>
        <Cells m={r} />
      </tr>
      {open &&
        campaigns.sort((a, b) => b.spend - a.spend).map((c) => (
          <tr key={c.campaign_id} className="border-b bg-muted/20 text-muted-foreground">
            <td className="px-3 py-2 pl-8" colSpan={2}>{c.name ?? c.campaign_id}<div className="text-[11px]">ID {c.campaign_id}</div></td>
            <td className={`px-3 py-2 ${STATUS[statusOf(c)].c}`}>{STATUS[statusOf(c)].l}</td>
            <Cells m={c} />
          </tr>
        ))}
    </>
  );
}

function Setup() {
  const qc = useQueryClient();
  const status = useServerFn(adsSetupStatus);
  const connect = useServerFn(startTikTokConnect);
  const del = useServerFn(deleteBusinessCenter);
  const st = useQuery({ queryKey: ["ads-setup"], queryFn: () => status() });
  const base = useQuery<{ bcs: { id: string; name: string; last_sync_at: string | null }[]; accounts: { advertiser_id: string; bc_id: string; name: string | null; currency: string; enabled: boolean; domains: string[]; last_error: string | null; last_sync_at: string | null }[] }>({ queryKey: ["ads-base"], enabled: false });
  const [name, setName] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["ads-base"] });

  async function go() {
    try {
      const r = await connect({ data: { name, origin: window.location.origin } });
      window.location.href = r.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }
  async function update(id: string, patch: { enabled?: boolean; domains?: string[] }) {
    const { error } = await supabase.from("tiktok_ad_accounts").update(patch).eq("advertiser_id", id);
    if (error) toast.error(error.message);
    else refresh();
  }

  return (
    <div className="mt-12">
      <h2 className="font-display text-2xl">BMs e contas</h2>
      <p className="mt-1 text-muted-foreground">
        Para ligar vendas às contas, use no link do anúncio: <code>utm_source=tiktok&amp;utm_campaign=__CAMPAIGN_ID__</code>
      </p>
      {st.data && !st.data.appConfigured && <p className="panel mt-4 p-4 text-destructive">Falta cadastrar o App ID e o Secret do app TikTok for Business.</p>}
      <div className="mt-4 flex max-w-lg gap-2">
        <Input placeholder="Nome da BM (ex: BM 1)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button disabled={!name.trim() || !st.data?.appConfigured} onClick={go}>Conectar BM</Button>
      </div>
      <div className="mt-6 space-y-6">
        {base.data?.bcs.map((b) => {
          const accs = base.data!.accounts.filter((a) => a.bc_id === b.id);
          return (
            <div key={b.id} className="panel p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-display text-xl">{b.name}</div>
                  <div className="text-[11px] text-muted-foreground">{accs.length} contas · última atualização {b.last_sync_at ? new Date(b.last_sync_at).toLocaleString("pt-BR") : "—"}</div>
                </div>
                <Button variant="outline" size="sm" onClick={async () => { if (confirm(`Remover ${b.name} e as contas dela?`)) { await del({ data: { id: b.id } }); refresh(); } }}>Remover BM</Button>
              </div>
              <div className="mt-3 divide-y">
                {accs.map((a) => (
                  <div key={a.advertiser_id} className="flex flex-wrap items-center gap-3 py-2">
                    <Switch checked={a.enabled} onCheckedChange={(v) => update(a.advertiser_id, { enabled: v })} />
                    <div className="min-w-48 flex-1">
                      {a.name ?? a.advertiser_id} <span className="text-[11px] text-muted-foreground">{a.currency}</span>
                      {a.last_error && <div className="text-[11px] text-destructive">{a.last_error}</div>}
                    </div>
                    <Input
                      className="max-w-sm"
                      placeholder="Domínios (separe por vírgula)"
                      defaultValue={a.domains.join(", ")}
                      onBlur={(e) => {
                        const d = [...new Set(e.target.value.split(",").map(normalizeDomain).filter(Boolean))];
                        if (d.join() !== a.domains.join()) update(a.advertiser_id, { domains: d });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
