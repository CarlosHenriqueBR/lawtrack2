import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { shortVisitor } from "@/lib/tracking";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Pesquisa — Lawtrack" }, { name: "description", content: "Pesquisar visitantes e vendas." }, { property: "og:title", content: "Pesquisa — Lawtrack" }, { property: "og:description", content: "Pesquisar visitantes e vendas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [term, setTerm] = useState("");
  const t = term.trim().replace(/[^a-zA-Z0-9_.@ -]/g, "");
  const q = useQuery({
    queryKey: ["search", t],
    enabled: t.length >= 3,
    queryFn: async () => {
      const like = `%${t}%`;
      const [s, tx] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, visitor_id, session_key, utm_campaign, ttclid, started_at, country")
          .or(`visitor_id.ilike.${like},session_key.ilike.${like},ttclid.ilike.${like},utm_campaign.ilike.${like},tt_campaign.ilike.${like}`)
          .order("started_at", { ascending: false })
          .limit(50),
        supabase.from("transactions").select("id, order_id, transaction_id, amount, currency, status, session_id").or(`order_id.ilike.${like},transaction_id.ilike.${like}`).limit(50),
      ]);
      return { sessions: s.data ?? [], tx: tx.data ?? [] };
    },
  });
  return (
    <div>
      <PageHeader title="Pesquisa" sub="Visitor ID, Session ID, Order ID, Transaction ID, TTCLID ou campanha." />
      <Input autoFocus placeholder="Digite ao menos 3 caracteres" value={term} onChange={(e) => setTerm(e.target.value)} className="max-w-lg" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="panel divide-y">
          <h2 className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground">Sessões</h2>
          {q.data?.sessions.map((s) => (
            <Link key={s.id} to="/journey/$sessionId" params={{ sessionId: s.id }} className="flex justify-between px-4 py-2.5 hover:bg-accent/40">
              <span className="text-primary">{shortVisitor(s.visitor_id)}</span>
              <span className="text-muted-foreground">{s.utm_campaign ?? "—"}</span>
              <span className="text-muted-foreground">{new Date(s.started_at).toLocaleString("pt-BR")}</span>
            </Link>
          ))}
        </div>
        <div className="panel divide-y">
          <h2 className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground">Vendas</h2>
          {q.data?.tx.map((x) => (
            <div key={x.id} className="flex justify-between px-4 py-2.5">
              <span>{x.order_id}</span>
              <span>
                {x.amount} {x.currency}
              </span>
              <span className="text-muted-foreground">{x.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
