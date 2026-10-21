import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useNow, useRealtimeInvalidate } from "@/lib/data";
import { flag, fmtDuration, sessionStatus, shortVisitor, trafficSource } from "@/lib/tracking";

export const Route = createFileRoute("/_authenticated/journey/$sessionId")({
  head: () => ({ meta: [{ title: "Visitor Journey — Lawtrack" }, { name: "description", content: "Jornada do visitante." }, { property: "og:title", content: "Visitor Journey — Lawtrack" }, { property: "og:description", content: "Jornada do visitante." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Journey,
});

function Journey() {
  const { sessionId } = Route.useParams();
  const now = useNow(1000);
  const q = useQuery({
    queryKey: ["journey", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*, events(id, created_at, url, type, event_id, funnel_steps(name)), funnels(name)")
        .eq("id", sessionId)
        .single();
      if (error) throw error;
      return { ...data, events: [...data.events].sort((a, b) => a.created_at.localeCompare(b.created_at)) };
    },
  });
  useRealtimeInvalidate([["journey", sessionId]]);
  const s = q.data;
  if (!s) return <p className="text-muted-foreground">{q.isError ? "Sessão não encontrada." : "Carregando…"}</p>;
  const status = sessionStatus(s.last_seen_at, s.converted, now);
  const end = status === "active" ? now : new Date(s.last_seen_at).getTime();

  const facts: [string, string | null | undefined][] = [
    ["Funil", s.funnels?.name],
    ["Status", status],
    ["País", `${flag(s.country)} ${[s.city, s.region, s.country].filter(Boolean).join(", ") || "—"}`],
    ["Origem", trafficSource(s)],
    ["Campanha", s.utm_campaign ?? s.tt_campaign],
    ["Conjunto", s.tt_adset],
    ["Anúncio", s.tt_ad ?? s.utm_content],
    ["TTCLID", s.ttclid ? s.ttclid.slice(0, 18) + "…" : null],
    ["Landing", s.landing_url],
    ["Referrer", s.referrer],
    ["Dispositivo", `${s.device} · ${s.os} · ${s.browser}`],
    ["Idioma / Tela", `${s.language ?? "—"} · ${s.screen ?? "—"}`],
    ["Páginas vistas", String(s.page_views)],
    ["Tempo no funil", fmtDuration(end - new Date(s.started_at).getTime())],
    ["Visitante recorrente", s.is_returning ? "Sim" : "Não"],
  ];

  return (
    <div>
      <Link to="/live" className="text-muted-foreground hover:text-foreground">
        ← Live Funnel
      </Link>
      <PageHeader title={`Visitor ${shortVisitor(s.visitor_id)}`} sub="Visitor Journey" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="panel p-6">
          <ol className="relative border-l border-border pl-6">
            <li className="mb-6">
              <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-success" />
              <div className="text-xs text-muted-foreground">{new Date(s.started_at).toLocaleString("pt-BR")}</div>
              <div>Entrada</div>
            </li>
            {s.events.map((e) => {
              let path = e.url ?? "";
              try {
                const u = new URL(path);
                path = u.host + u.pathname;
              } catch {
                /* raw */
              }
              return (
                <li key={e.id} className="mb-6">
                  <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-primary" />
                  <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleTimeString("pt-BR")}</div>
                  <div className="text-foreground">{e.funnel_steps?.name ?? "Página fora do funil"}</div>
                  <div className="text-xs text-muted-foreground">{path}</div>
                </li>
              );
            })}
          </ol>
        </div>
        <dl className="panel divide-y self-start">
          {facts.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="truncate text-right">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
