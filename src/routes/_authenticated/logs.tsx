import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, downloadCsv } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchFunnels } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({ meta: [{ title: "System Logs — Lawtrack" }, { name: "description", content: "Logs e auditoria." }] }),
  component: Logs,
});

const LEVEL_CLS: Record<string, string> = { INFO: "text-muted-foreground", WARNING: "text-warning", ERROR: "text-destructive", CRITICAL: "text-primary font-bold" };

function Logs() {
  const [tab, setTab] = useState<"system" | "audit" | "raw">("system");
  return (
    <div>
      <PageHeader title="Logs" sub="Tudo fica anotado.">
        <div className="flex rounded-md border p-0.5">
          {(
            [
              ["system", "System Logs"],
              ["raw", "Event Explorer"],
              ["audit", "Auditoria"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-sm px-3 py-1 ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {l}
            </button>
          ))}
        </div>
      </PageHeader>
      {tab === "system" ? <SystemLogs /> : tab === "audit" ? <AuditLogs /> : <EventExplorer />}
    </div>
  );
}

function SystemLogs() {
  const qc = useQueryClient();
  const funnels = useQuery({ queryKey: ["funnels"], queryFn: fetchFunnels });
  const [f, setF] = useState({ level: "", source: "", funnel: "", text: "", date: "" });
  const q = useQuery({
    queryKey: ["syslogs", f],
    queryFn: async () => {
      let r = supabase.from("system_logs").select("*").order("created_at", { ascending: false }).limit(300);
      if (f.level) r = r.eq("level", f.level);
      if (f.source) r = r.eq("source", f.source);
      if (f.funnel) r = r.eq("funnel_id", f.funnel);
      if (f.text) r = r.or(`message.ilike.%${f.text.replace(/[%,()]/g, "")}%,visitor_id.eq.${f.text.replace(/[^a-zA-Z0-9_-]/g, "")}`);
      if (f.date) {
        const d = new Date(f.date + "T00:00:00");
        r = r.gte("created_at", d.toISOString()).lt("created_at", new Date(d.getTime() + 86_400_000).toISOString());
      }
      const { data, error } = await r;
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel("syslogs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "system_logs" }, () => qc.invalidateQueries({ queryKey: ["syslogs"] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
  const sel = "rounded-md border bg-card px-3 py-1.5";
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <select className={sel} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
          <option value="">Todos os níveis</option>
          {["INFO", "WARNING", "ERROR", "CRITICAL"].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select className={sel} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
          <option value="">Todas as origens</option>
          {["tracking", "digistore24", "tiktok"].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select className={sel} value={f.funnel} onChange={(e) => setF({ ...f, funnel: e.target.value })}>
          <option value="">Todos os funis</option>
          {funnels.data?.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <Input type="date" className="w-40" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <Input className="w-64" placeholder="Buscar mensagem ou visitor id" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
        <Button variant="outline" onClick={() => downloadCsv("logs.csv", (q.data ?? []) as unknown as Record<string, unknown>[])}>
          CSV
        </Button>
      </div>
      <div className="panel divide-y font-mono text-xs">
        {q.data?.map((l) => (
          <div key={l.id} className="fade-in-row flex gap-4 px-4 py-2">
            <span className="tabular-nums text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
            <span className={`w-16 ${LEVEL_CLS[l.level]}`}>{l.level}</span>
            <span className="w-20 text-muted-foreground">{l.source}</span>
            <span className="flex-1">{l.message}</span>
            {l.status_code && <span className="text-muted-foreground">{l.status_code}</span>}
            {l.duration_ms != null && <span className="text-muted-foreground">{l.duration_ms}ms</span>}
            {l.session_id && (
              <Link to="/journey/$sessionId" params={{ sessionId: l.session_id }} className="text-primary hover:underline">
                sessão
              </Link>
            )}
          </div>
        ))}
        {q.data?.length === 0 && <p className="p-8 text-center text-muted-foreground">Nenhum registro.</p>}
      </div>
    </>
  );
}

function AuditLogs() {
  const q = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300)).data ?? [],
  });
  return (
    <div className="panel divide-y text-xs">
      {q.data?.map((a) => (
        <div key={a.id} className="flex gap-4 px-4 py-2">
          <span className="tabular-nums text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
          <span className="w-56 truncate">{a.actor_email ?? "sistema"}</span>
          <span className="w-44 text-primary">{a.action}</span>
          <span className="flex-1 truncate text-muted-foreground">
            {a.target} {a.details && typeof a.details === "object" && "name" in a.details ? `— ${String((a.details as { name: unknown }).name)}` : ""}
          </span>
        </div>
      ))}
      {q.data?.length === 0 && <p className="p-8 text-center text-muted-foreground">Nenhuma ação registrada.</p>}
    </div>
  );
}

function EventExplorer() {
  const q = useQuery({
    queryKey: ["raw-events"],
    queryFn: async () =>
      (await supabase.from("events").select("event_id, type, url, created_at, funnel_id, step_id, sessions(visitor_id, session_key)").order("created_at", { ascending: false }).limit(100)).data ??
      [],
  });
  return (
    <div className="space-y-2">
      {q.data?.map((e) => (
        <pre key={e.event_id} className="panel overflow-x-auto p-3 text-xs">
          {JSON.stringify(
            {
              event: e.type,
              event_id: e.event_id,
              visitor_id: e.sessions?.visitor_id,
              session_id: e.sessions?.session_key,
              funnel_id: e.funnel_id,
              step_id: e.step_id,
              url: e.url,
              timestamp: e.created_at,
            },
            null,
            2,
          )}
        </pre>
      ))}
    </div>
  );
}
