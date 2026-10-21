import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/health")({
  head: () => ({ meta: [{ title: "System Health — Lawtrack" }, { name: "description", content: "Saúde do sistema." }, { property: "og:title", content: "System Health — Lawtrack" }, { property: "og:description", content: "Saúde do sistema." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Health,
});

type St = "Operational" | "Warning" | "Offline";
const CLS: Record<St, string> = { Operational: "bg-success", Warning: "bg-warning", Offline: "bg-destructive" };

function Health() {
  const q = useQuery({
    queryKey: ["health"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 60_000).toISOString();
      const min5 = new Date(Date.now() - 5 * 60_000).toISOString();
      const t0 = performance.now();
      const api = await fetch("/api/public/health").then((r) => r.json() as Promise<{ database: string }>).catch(() => null);
      const latency = Math.round(performance.now() - t0);
      const c = async (table: "system_logs" | "event_queue" | "events", f: (q: any) => any) => {
        const { count } = await f(supabase.from(table).select("id", { count: "exact", head: true }));
        return count ?? 0;
      };
      const [errs, pending, dead, events5, ttErr, ttOk, dsErr, dsOk, lastEvt] = await Promise.all([
        c("system_logs", (x) => x.in("level", ["ERROR", "CRITICAL"]).gte("created_at", since)),
        c("event_queue", (x) => x.in("status", ["pending", "retry", "failed"])),
        c("event_queue", (x) => x.eq("status", "dead_letter")),
        c("events", (x) => x.gte("created_at", min5)),
        c("system_logs", (x) => x.eq("source", "tiktok").in("level", ["ERROR", "CRITICAL", "WARNING"]).gte("created_at", since)),
        c("system_logs", (x) => x.eq("source", "tiktok").eq("level", "INFO").gte("created_at", since)),
        c("system_logs", (x) => x.eq("source", "digistore24").in("level", ["ERROR", "WARNING"]).gte("created_at", since)),
        c("system_logs", (x) => x.eq("source", "digistore24").eq("level", "INFO").gte("created_at", since)),
        supabase.from("events").select("created_at").order("created_at", { ascending: false }).limit(1),
      ]);
      const ch = supabase.channel("health-probe");
      const rt = await new Promise<St>((res) => {
        const t = setTimeout(() => res("Warning"), 4000);
        ch.subscribe((s) => {
          if (s === "SUBSCRIBED") {
            clearTimeout(t);
            res("Operational");
          }
        });
      });
      supabase.removeChannel(ch);
      const last = lastEvt.data?.[0]?.created_at;
      return { api, latency, errs, pending, dead, events5, ttErr, ttOk, dsErr, dsOk, rt, last };
    },
  });
  const d = q.data;
  const services: [string, St, string][] = d
    ? [
        ["API", d.api ? "Operational" : "Offline", `${d.latency}ms`],
        ["Database", d.api?.database === "healthy" ? "Operational" : "Offline", ""],
        ["Realtime", d.rt, ""],
        ["Queue", d.dead > 0 ? "Warning" : d.pending > 50 ? "Warning" : "Operational", `${d.pending} pendentes · ${d.dead} dead letter`],
        ["TikTok API", d.ttErr > 0 && d.ttOk === 0 ? "Warning" : "Operational", `${d.ttOk} ok · ${d.ttErr} falhas (1h)`],
        ["Digistore Webhook", d.dsErr > 0 ? "Warning" : "Operational", `${d.dsOk} recebidos · ${d.dsErr} recusados (1h)`],
      ]
    : [];
  const alerts: string[] = [];
  if (d) {
    if (d.dead > 0) alerts.push(`${d.dead} eventos na dead letter — verifique o token do TikTok.`);
    if (d.ttErr > 0) alerts.push("TikTok retornou erros na última hora.");
    if (d.dsErr > 0) alerts.push("Webhook Digistore24 recusou chamadas na última hora.");
    if (d.pending > 50) alerts.push("A fila está crescendo.");
    if (d.last && Date.now() - new Date(d.last).getTime() > 6 * 3600_000) alerts.push("Nenhum evento de tracking nas últimas 6 horas.");
    if (d.errs > 20) alerts.push(`Taxa de erro alta: ${d.errs} erros na última hora.`);
  }
  return (
    <div>
      <PageHeader title="System Health" sub="Atualiza a cada 15 segundos." />
      {alerts.length > 0 && (
        <div className="panel mb-6 border-destructive p-4">
          {alerts.map((a) => (
            <p key={a} className="text-destructive">
              ⚠ {a}
            </p>
          ))}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {services.map(([n, s, m]) => (
          <div key={n} className="panel p-5">
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl">{n}</span>
              <span className="flex items-center gap-2 text-xs">
                <span className={`pulse-dot h-2 w-2 rounded-full ${CLS[s]}`} />
                {s}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{m}</p>
          </div>
        ))}
      </div>
      {d && (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric l="Eventos (5 min)" v={d.events5} />
          <Metric l="Erros (1h)" v={d.errs} />
          <Metric l="Fila pendente" v={d.pending} />
          <Metric l="Último evento" v={d.last ? new Date(d.last).toLocaleTimeString("pt-BR") : "—"} />
        </div>
      )}
    </div>
  );
}

function Metric({ l, v }: { l: string; v: string | number }) {
  return (
    <div className="panel p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{l}</div>
      <div className="mt-2 font-display text-3xl">{v}</div>
    </div>
  );
}
