import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCheckoutLeads } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [
    { title: "Emails salvos — Lawtrack" },
    { name: "description", content: "Acompanhamento dos emails capturados nos checkouts." },
    { property: "og:title", content: "Emails salvos — Lawtrack" },
    { property: "og:description", content: "Acompanhamento dos emails capturados nos checkouts." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Leads,
});

function Leads() {
  const fetchLeads = useServerFn(listCheckoutLeads);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ["checkout-leads", search, page],
    queryFn: () => fetchLeads({ data: { page, search } }),
    refetchInterval: 30000,
  });
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 50));

  return <div>
    <PageHeader title="Emails salvos">
      <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
        <RefreshCw className={`h-4 w-4 ${query.isFetching ? "motion-safe:animate-spin" : ""}`} /> Atualizar
      </Button>
    </PageHeader>
    <form className="mb-6 flex max-w-lg gap-2" onSubmit={(event) => {
      event.preventDefault(); setPage(0); setSearch(draft.trim());
    }}>
      <Input aria-label="Buscar email" placeholder="Buscar email" value={draft} maxLength={254} onChange={(event) => setDraft(event.target.value)} />
      <Button type="submit" variant="outline" size="icon" aria-label="Pesquisar" title="Pesquisar"><Search className="h-4 w-4" /></Button>
    </form>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
      <span>{query.data ? `${total} ${total === 1 ? "registro" : "registros"}${search ? " encontrados" : " salvos"}` : "—"}</span>
      {query.dataUpdatedAt > 0 && <span className="text-xs">Atualizado às {new Date(query.dataUpdatedAt).toLocaleTimeString("pt-BR")}</span>}
    </div>
    {query.isError ? <div role="alert" className="border-y py-8 text-destructive">Não foi possível carregar os emails. Tente atualizar.</div> :
      <div className="overflow-x-auto border-y">
        <table className="w-full text-left">
          <thead className="border-b text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>{["Data", "Email informado", "Email da transação", "Origem", "Campanha", "Email de acesso"].map((label) => <th key={label} className="px-4 py-3 font-normal">{label}</th>)}</tr>
          </thead>
          <tbody>
            {(query.isPending || rows.length === 0) && <tr><td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">{query.isPending ? "Carregando emails…" : search ? "Nenhum email encontrado." : "Nenhum email salvo ainda."}</td></tr>}
            {rows.map((lead) => <tr key={lead.id} className="border-b last:border-0">
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(lead.created_at).toLocaleString("pt-BR")}</td>
              <td className="min-w-48 max-w-80 break-all px-4 py-3">{lead.email}</td>
              <td className="min-w-48 max-w-80 break-all px-4 py-3 text-muted-foreground">{lead.transaction_email}</td>
              <td className="max-w-48 break-words px-4 py-3">{lead.utm_source ?? "—"}</td>
              <td className="max-w-48 break-words px-4 py-3">{lead.utm_campaign ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{lead.access_email_sent_at ? new Date(lead.access_email_sent_at).toLocaleString("pt-BR") : "Não enviado"}</td>
            </tr>)}
          </tbody>
        </table>
      </div>}
    <div className="mt-4 flex items-center justify-end gap-3">
      <span className="text-xs text-muted-foreground">Página {page + 1} de {pages}</span>
      <Button variant="outline" size="icon" title="Página anterior" aria-label="Página anterior" disabled={page === 0 || query.isFetching} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
      <Button variant="outline" size="icon" title="Próxima página" aria-label="Próxima página" disabled={page + 1 >= pages || query.isFetching} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  </div>;
}