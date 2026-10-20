import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, downloadCsv } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { fetchFunnels, periodRange, type Period } from "@/lib/data";
import { trafficSource } from "@/lib/tracking";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Relatórios — Lawtrack" }, { name: "description", content: "Relatórios de conversão." }] }),
  component: Reports,
});

const DIMS = {
  campaign: { label: "Campanha", fn: (s: any) => s.utm_campaign ?? s.tt_campaign ?? "(sem campanha)" },
  source: { label: "Origem", fn: (s: any) => trafficSource(s) },
  country: { label: "País", fn: (s: any) => s.country ?? "—" },
  device: { label: "Dispositivo", fn: (s: any) => s.device ?? "—" },
  landing: { label: "Landing page", fn: (s: any) => { try { return new URL(s.landing_url).pathname; } catch { return "—"; } } },
  hour: { label: "Horário", fn: (s: any) => `${String(new Date(s.started_at).getHours()).padStart(2, "0")}h` },
} as const;
type Dim = keyof typeof DIMS;

function Reports() {
  const [period, setPeriod] = useState<Period>("7d");
  const [dim, setDim] = useState<Dim>("campaign");
  const [funnelId, setFunnelId] = useState("");
  const funnels = useQuery({ queryKey: ["funnels"], queryFn: fetchFunnels });
  const [from, to] = periodRange(period);
  const data = useQuery({
    queryKey: ["report", period, funnelId],
    queryFn: async () => {
      let s = supabase.from("sessions").select("id, funnel_id, max_step_order, converted, utm_campaign, tt_campaign, utm_source, ttclid, referrer, country, device, landing_url, started_at").gte("started_at", from.toISOString()).lt("started_at", to.toISOString()).limit(10000);
      let t = supabase.from("transactions").select("session_id, amount, status").eq("status", "approved").gte("occurred_at", from.toISOString()).lt("occurred_at", to.toISOString());
      if (funnelId) {
        s = s.eq("funnel_id", funnelId);
        t = t.eq("funnel_id", funnelId);
      }
      const [a, b] = await Promise.all([s, t]);
      return { sessions: a.data ?? [], tx: b.data ?? [] };
    },
  });

  const rows = useMemo(() => {
    const rev = new Map<string, number>();
    data.data?.tx.forEach((t) => t.session_id && rev.set(t.session_id, (rev.get(t.session_id) ?? 0) + Number(t.amount ?? 0)));
    const m = new Map<string, { sessoes: number; checkout: number; vendas: number; receita: number }>();
    for (const s of data.data?.sessions ?? []) {
      const k = DIMS[dim].fn(s);
      const r = m.get(k) ?? { sessoes: 0, checkout: 0, vendas: 0, receita: 0 };
      r.sessoes++;
      if (s.max_step_order >= 4) r.checkout++;
      if (s.converted) r.vendas++;
      r.receita += rev.get(s.id) ?? 0;
      m.set(k, r);
    }
    return [...m].map(([k, v]) => ({ [DIMS[dim].label]: k, ...v, conversao: v.sessoes ? +((v.vendas / v.sessoes) * 100).toFixed(1) : 0 })).sort((a, b) => b.sessoes - a.sessoes);
  }, [data.data, dim]);

  const steps = funnels.data?.find((f) => f.id === funnelId)?.funnel_steps ?? funnels.data?.[0]?.funnel_steps ?? [];
  const abandon = steps.map((st, i) => {
    const ss = data.data?.sessions ?? [];
    const here = ss.filter((s) => s.max_step_order >= st.step_order).length;
    const next = steps[i + 1] ? ss.filter((s) => s.max_step_order >= steps[i + 1]!.step_order).length : here;
    return { etapa: st.name, visitantes: here, abandono: here - next, taxa: here ? +(((here - next) / here) * 100).toFixed(1) : 0 };
  });

  const sel = "rounded-md border bg-card px-3 py-1.5";
  return (
    <div>
      <PageHeader title="Relatórios">
        <div className="flex flex-wrap gap-2">
          <select className={sel} value={funnelId} onChange={(e) => setFunnelId(e.target.value)}>
            <option value="">Todos os funis</option>
            {funnels.data?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select className={sel} value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="today">Hoje</option>
            <option value="yesterday">Ontem</option>
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
          </select>
        </div>
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center gap-1">
        {(Object.keys(DIMS) as Dim[]).map((d) => (
          <button key={d} onClick={() => setDim(d)} className={`rounded-sm px-3 py-1 ${dim === d ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {DIMS[d].label}
          </button>
        ))}
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => downloadCsv(`relatorio-${dim}.csv`, rows)}>
          Exportar CSV
        </Button>
      </div>
      <Table rows={rows} />

      <div className="mb-3 mt-10 flex items-center justify-between">
        <h2 className="font-display text-2xl">Abandono por etapa</h2>
        <Button variant="outline" size="sm" onClick={() => downloadCsv("abandono.csv", abandon)}>
          Exportar CSV
        </Button>
      </div>
      <Table rows={abandon} />
    </div>
  );
}

function Table({ rows }: { rows: Record<string, string | number>[] }) {
  if (!rows.length) return <p className="panel p-8 text-center text-muted-foreground">Sem dados no período.</p>;
  const cols = Object.keys(rows[0]!);
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full text-left">
        <thead className="border-b text-[11px] uppercase tracking-widest text-muted-foreground">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-4 py-3 font-normal">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {cols.map((c) => (
                <td key={c} className="px-4 py-2.5 tabular-nums">
                  {c === "conversao" || c === "taxa" ? `${r[c]}%` : c === "receita" ? Number(r[c]).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : r[c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
