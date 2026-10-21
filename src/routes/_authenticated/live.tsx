import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { fetchFunnels, useNow, useRealtimeInvalidate } from "@/lib/data";
import { flag, fmtDuration, sessionStatus, shortVisitor, trafficSource, type SessionStatus } from "@/lib/tracking";

export const Route = createFileRoute("/_authenticated/live")({
  head: () => ({ meta: [{ title: "Live Funnel — Lawtrack" }, { name: "description", content: "Visitantes ao vivo." }, { property: "og:title", content: "Live Funnel — Lawtrack" }, { property: "og:description", content: "Visitantes ao vivo." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Live,
});

const STATUS: Record<SessionStatus, { label: string; cls: string }> = {
  active: { label: "Ativo", cls: "bg-success" },
  inactive: { label: "Inativo", cls: "bg-warning" },
  left: { label: "Saiu", cls: "bg-muted-foreground" },
  converted: { label: "Converteu", cls: "bg-primary" },
};

function Live() {
  const now = useNow(1000);
  const funnels = useQuery({ queryKey: ["funnels"], queryFn: fetchFunnels });
  const stepName = new Map(funnels.data?.flatMap((f) => f.funnel_steps.map((s) => [s.id, s.name] as const)) ?? []);

  const sessions = useQuery({
    queryKey: ["live-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .gte("last_seen_at", new Date(Date.now() - 10 * 60_000).toISOString())
        .order("last_seen_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
    refetchInterval: 20_000,
  });
  const feed = useQuery({
    queryKey: ["live-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, created_at, url, step_id, session_id, sessions(visitor_id)")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data;
    },
  });
  useRealtimeInvalidate([["live-sessions"], ["live-feed"]]);

  const rows = (sessions.data ?? []).map((s) => ({ ...s, status: sessionStatus(s.last_seen_at, s.converted, now) }));
  const online = rows.filter((r) => r.status === "active").length;

  return (
    <div>
      <PageHeader title="Live Funnel" sub="Atualiza sozinho. Nenhum rastro passa despercebido.">
        <div className="panel flex items-center gap-3 px-4 py-2">
          <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-success" />
          <span className="font-display text-3xl">{online}</span>
          <span className="text-muted-foreground">usuários online</span>
        </div>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="panel overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                {["Visitor", "País", "Origem", "Campanha", "Etapa", "Página", "Tempo", "Device", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-muted-foreground">
                    Ninguém no funil agora. Instale o script em suas páginas para começar.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                let path = r.current_url ?? "";
                try {
                  path = new URL(path).pathname;
                } catch {
                  /* keep raw */
                }
                const end = r.status === "active" ? now : new Date(r.last_seen_at).getTime();
                return (
                  <tr key={r.id} className={`border-b last:border-0 hover:bg-accent/40 ${r.status === "left" ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <Link to="/journey/$sessionId" params={{ sessionId: r.id }} className="text-primary hover:underline">
                        {shortVisitor(r.visitor_id)}
                      </Link>
                      {r.is_returning && <span className="ml-1 text-[10px] text-muted-foreground">↺</span>}
                    </td>
                    <td className="px-4 py-3">
                      {flag(r.country)} {r.country ?? "—"}
                    </td>
                    <td className="px-4 py-3">{trafficSource(r)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.utm_campaign ?? r.tt_campaign ?? "—"}</td>
                    <td className="px-4 py-3">{(r.current_step_id && stepName.get(r.current_step_id)) || "—"}</td>
                    <td className="max-w-40 truncate px-4 py-3 text-muted-foreground">{path}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtDuration(end - new Date(r.started_at).getTime())}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.device} · {r.browser}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${STATUS[r.status].cls}`} />
                        {STATUS[r.status].label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel p-4">
          <h2 className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Registro ao vivo</h2>
          <ul className="space-y-2">
            {(feed.data ?? []).map((e) => {
              let path = e.url ?? "";
              try {
                path = new URL(path).pathname;
              } catch {
                /* raw */
              }
              return (
                <li key={e.id} className="fade-in-row flex gap-3 rounded-sm px-1 text-xs">
                  <span className="tabular-nums text-muted-foreground">
                    {new Date(e.created_at).toLocaleTimeString("pt-BR")}
                  </span>
                  <span className="truncate">
                    {e.sessions ? shortVisitor(e.sessions.visitor_id) : "?"} →{" "}
                    {(e.step_id && stepName.get(e.step_id)) || path}
                  </span>
                </li>
              );
            })}
            {feed.data?.length === 0 && <li className="text-muted-foreground">Silêncio. Por enquanto.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
