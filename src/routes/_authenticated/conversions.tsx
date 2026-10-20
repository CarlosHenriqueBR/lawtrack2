import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, downloadCsv } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { shortVisitor } from "@/lib/tracking";

export const Route = createFileRoute("/_authenticated/conversions")({
  head: () => ({ meta: [{ title: "Conversões — Lawtrack" }, { name: "description", content: "Vendas recebidas." }] }),
  component: Conversions,
});

const STATUS_CLS: Record<string, string> = {
  approved: "text-success",
  pending: "text-warning",
  refunded: "text-muted-foreground",
  chargeback: "text-destructive",
  cancelled: "text-muted-foreground",
};

function Conversions() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*, funnels(name)").order("occurred_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel("tx")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => qc.invalidateQueries({ queryKey: ["transactions"] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
  const rows = q.data ?? [];
  const approved = rows.filter((r) => r.status === "approved");
  const revenue = approved.reduce((a, r) => a + Number(r.amount ?? 0), 0);

  return (
    <div>
      <PageHeader title="Conversões" sub="Vendas confirmadas pela Digistore24.">
        <Button
          variant="outline"
          onClick={() =>
            downloadCsv(
              "conversoes.csv",
              rows.map(({ funnels, ...r }) => ({ ...r, funnel: funnels?.name })),
            )
          }
        >
          Exportar CSV
        </Button>
      </PageHeader>
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat l="Vendas aprovadas" v={approved.length} />
        <Stat l="Receita" v={revenue.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} />
        <Stat l="Ticket médio" v={approved.length ? (revenue / approved.length).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"} />
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>
              {["Data", "Pedido", "Produto", "Valor", "Status", "Funil", "Visitor", "Campanha"].map((h) => (
                <th key={h} className="px-4 py-3 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                  Nenhuma venda ainda. Configure o webhook em Integrações.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-3 text-muted-foreground">{new Date(r.occurred_at).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">{r.order_id}</td>
                <td className="px-4 py-3">{r.product ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">
                  {r.amount ?? "—"} {r.currency}
                </td>
                <td className={`px-4 py-3 ${STATUS_CLS[r.status]}`}>{r.status}</td>
                <td className="px-4 py-3">{r.funnels?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  {r.session_id && r.visitor_id ? (
                    <Link to="/journey/$sessionId" params={{ sessionId: r.session_id }} className="text-primary hover:underline">
                      {shortVisitor(r.visitor_id)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.campaign ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ l, v }: { l: string; v: string | number }) {
  return (
    <div className="panel p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{l}</div>
      <div className="mt-2 font-display text-4xl">{v}</div>
    </div>
  );
}
