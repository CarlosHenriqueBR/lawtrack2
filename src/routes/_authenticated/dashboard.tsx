import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { FunnelMap } from "@/components/FunnelMap";
import { fetchFunnels, periodRange, useRealtimeInvalidate, type Period } from "@/lib/data";
import { trafficSource } from "@/lib/tracking";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Lawtrack" }, { name: "description", content: "Visão geral dos funis." }, { property: "og:title", content: "Dashboard — Lawtrack" }, { property: "og:description", content: "Visão geral dos funis." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
];

function Dashboard() {
  const [period, setPeriod] = useState<Period>("today");
  const [funnelId, setFunnelId] = useState<string>("");
  const funnels = useQuery({ queryKey: ["funnels"], queryFn: fetchFunnels });
  const funnel = funnels.data?.find((f) => f.id === funnelId) ?? funnels.data?.[0];
  const [from, to] = periodRange(period);

  const sessions = useQuery({
    queryKey: ["sessions", funnel?.id, period],
    enabled: !!funnel,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("funnel_id", funnel!.id)
        .gte("started_at", from.toISOString())
        .lt("started_at", to.toISOString())
        .order("started_at")
        .limit(5000);
      if (error) throw error;
      return data;
    },
  });
  const online = useQuery({
    queryKey: ["online", funnel?.id],
    enabled: !!funnel,
    queryFn: async () => {
      const { count } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("funnel_id", funnel!.id)
        .eq("converted", false)
        .gte("last_seen_at", new Date(Date.now() - 45_000).toISOString());
      return count ?? 0;
    },
    refetchInterval: 15_000,
  });
  const sales = useQuery({
    queryKey: ["sales", funnel?.id, period],
    enabled: !!funnel,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("amount, occurred_at")
        .eq("funnel_id", funnel!.id)
        .eq("status", "approved")
        .gte("occurred_at", from.toISOString())
        .lt("occurred_at", to.toISOString());
      return data ?? [];
    },
  });
  useRealtimeInvalidate([["sessions"], ["online"], ["sales"]]);

  const list = sessions.data ?? [];
  const steps = funnel?.funnel_steps ?? [];
  const checkoutOrder = steps.find((s) => /checkout/i.test(s.name))?.step_order ?? steps.at(-2)?.step_order ?? 99;
  const views = list.reduce((a, s) => a + s.page_views, 0);
  const checkouts = list.filter((s) => s.max_step_order >= checkoutOrder).length;
  const saleRows = sales.data ?? [];
  const buys = saleRows.length || list.filter((s) => s.converted).length;
  const revenue = saleRows.reduce((a, r) => a + Number(r.amount ?? 0), 0);
  const money = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

  const chart = useMemo(() => {
    const byHour = period === "today" || period === "yesterday";
    const m = new Map<string, number>();
    for (const s of list) {
      const d = new Date(s.started_at);
      const k = byHour ? `${String(d.getHours()).padStart(2, "0")}h` : `${d.getDate()}/${d.getMonth() + 1}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m].map(([k, v]) => ({ k, v }));
  }, [list, period]);

  const sources = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach((s) => m.set(trafficSource(s), (m.get(trafficSource(s)) ?? 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [list]);

  const cards = [
    { l: "Usuários online", v: online.data ?? 0, live: true },
    { l: "Sessões", v: list.length },
    { l: "Visitas", v: views },
    { l: "Checkout iniciado", v: checkouts },
    { l: "Compras", v: buys },
    { l: "Conversão", v: list.length ? `${((buys / list.length) * 100).toFixed(1)}%` : "0%" },
    { l: "Receita", v: saleRows.length ? money(revenue) : "—", hint: "Vendas aprovadas pela Digistore24" },
    { l: "Ticket médio", v: saleRows.length ? money(revenue / saleRows.length) : "—", hint: "Vendas aprovadas pela Digistore24" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" sub={funnel?.name}>
        <div className="flex gap-2">
          {(funnels.data?.length ?? 0) > 1 && (
            <select
              className="rounded-md border bg-card px-3 py-1.5"
              value={funnel?.id}
              onChange={(e) => setFunnelId(e.target.value)}
            >
              {funnels.data!.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex rounded-md border p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`rounded-sm px-3 py-1 ${period === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.l} className="panel p-4" title={c.hint}>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              {c.live && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-success" />}
              {c.l}
            </div>
            <div className="mt-2 font-display text-4xl">{typeof c.v === "number" ? c.v.toLocaleString("pt-BR") : c.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="panel p-6 lg:col-span-2">
          <h2 className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">Mapa do funil</h2>
          <FunnelMap steps={steps} sessions={list} />
        </div>
        <div className="panel p-6">
          <h2 className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">Origem do tráfego</h2>
          {sources.length === 0 && <p className="text-muted-foreground">Sem visitas no período.</p>}
          <ul className="space-y-2">
            {sources.map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="text-muted-foreground">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel mt-6 h-64 p-6">
        <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Sessões</h2>
        <ResponsiveContainer width="100%" height="90%">
          <AreaChart data={chart}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="k" stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
            <Area dataKey="v" name="Sessões" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
