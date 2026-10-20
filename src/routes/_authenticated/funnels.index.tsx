import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchFunnels } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/funnels/")({
  head: () => ({ meta: [{ title: "Funis — Lawtrack" }, { name: "description", content: "Gerencie seus funis." }] }),
  component: Funnels,
});

function Funnels() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["funnels"], queryFn: fetchFunnels });
  const [name, setName] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.from("funnels").insert({ name }).select("id").single();
    if (error) return toast.error(error.message);
    navigate({ to: "/funnels/$id", params: { id: data.id } });
  }

  return (
    <div>
      <PageHeader title="Funis" sub="Cada funil é uma página do caderno.">
        <form onSubmit={create} className="flex gap-2">
          <Input placeholder="Nome do novo funil" value={name} onChange={(e) => setName(e.target.value)} required />
          <Button type="submit">Criar</Button>
        </form>
      </PageHeader>
      <div className="grid gap-3 md:grid-cols-2">
        {q.data?.map((f) => (
          <Link key={f.id} to="/funnels/$id" params={{ id: f.id }} className="panel block p-5 hover:border-primary">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">{f.name}</h2>
              <span className={`text-xs ${f.status === "active" ? "text-success" : "text-muted-foreground"}`}>
                {f.status === "active" ? "ativo" : "pausado"}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{f.domain ?? "sem domínio"}</p>
            <p className="mt-3 text-xs text-muted-foreground">{f.funnel_steps.map((s) => s.name).join(" → ")}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
