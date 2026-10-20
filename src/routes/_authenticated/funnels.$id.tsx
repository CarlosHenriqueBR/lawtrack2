import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchFunnels, type Step } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/funnels/$id")({
  head: () => ({ meta: [{ title: "Configurar funil — Lawtrack" }, { name: "description", content: "Etapas e script do funil." }] }),
  component: FunnelDetail,
});

function FunnelDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["funnels"], queryFn: fetchFunnels });
  const f = q.data?.find((x) => x.id === id);
  const [form, setForm] = useState({ name: "", domain: "", base_url: "", description: "", tiktok_pixel_id: "", status: "active" });
  const [newStep, setNewStep] = useState({ name: "", url_pattern: "" });
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (f)
      setForm({
        name: f.name,
        domain: f.domain ?? "",
        base_url: f.base_url ?? "",
        description: f.description ?? "",
        tiktok_pixel_id: f.tiktok_pixel_id ?? "",
        status: f.status,
      });
  }, [f?.id, f?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => qc.invalidateQueries({ queryKey: ["funnels"] });

  if (!f) return <p className="text-muted-foreground">{q.isLoading ? "Carregando…" : "Funil não encontrado."}</p>;
  const steps = f.funnel_steps;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from("funnels")
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Funil salvo");
    refresh();
  }
  async function addStep(e: React.FormEvent) {
    e.preventDefault();
    const order = (steps.at(-1)?.step_order ?? 0) + 1;
    const { error } = await supabase.from("funnel_steps").insert({ ...newStep, funnel_id: id, step_order: order });
    if (error) { toast.error(error.message); return; }
    setNewStep({ name: "", url_pattern: "" });
    refresh();
  }
  async function updateStep(s: Step, patch: Partial<Step>) {
    const { error } = await supabase.from("funnel_steps").update(patch).eq("id", s.id);
    if (error) toast.error(error.message);
    refresh();
  }
  async function move(i: number, dir: -1 | 1) {
    const a = steps[i];
    const b = steps[i + dir];
    if (!a || !b) return;
    await supabase.from("funnel_steps").update({ step_order: b.step_order }).eq("id", a.id);
    await supabase.from("funnel_steps").update({ step_order: a.step_order }).eq("id", b.id);
    refresh();
  }
  async function removeStep(s: Step) {
    if (!confirm(`Remover a etapa "${s.name}"?`)) return;
    await supabase.from("funnel_steps").delete().eq("id", s.id);
    refresh();
  }

  const snippet = `<script src="${origin}/api/public/tracker.js" data-funnel="${f.id}" defer></script>`;

  return (
    <div>
      <Link to="/funnels" className="text-muted-foreground hover:text-foreground">
        ← Funis
      </Link>
      <PageHeader title={f.name} sub={`ID ${f.id}`} />

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={save} className="panel space-y-4 p-6">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Dados do funil</h2>
          {(
            [
              ["name", "Nome"],
              ["domain", "Domínio"],
              ["base_url", "URL base"],
              ["tiktok_pixel_id", "Pixel TikTok"],
            ] as const
          ).map(([k, l]) => (
            <div key={k} className="space-y-1.5">
              <Label>{l}</Label>
              <Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={k === "name"} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <select
              className="w-full rounded-md border bg-card px-3 py-2"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">Ativo (recebendo dados)</option>
              <option value="paused">Pausado</option>
            </select>
          </div>
          <Button type="submit">Salvar</Button>
        </form>

        <div className="space-y-6">
          <div className="panel p-6">
            <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Script de rastreamento</h2>
            <p className="mb-3 text-muted-foreground">
              Cole antes de <code>&lt;/head&gt;</code> em todas as páginas do funil. Para exigir consentimento, adicione{" "}
              <code>data-consent="required"</code> e chame <code>Lawtrack.grantConsent()</code> quando o visitante aceitar.
            </p>
            <pre className="overflow-x-auto rounded-sm bg-muted p-3 text-xs">{snippet}</pre>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                navigator.clipboard.writeText(snippet);
                toast.success("Copiado");
              }}
            >
              Copiar
            </Button>
          </div>

          <div className="panel p-6">
            <h2 className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">Etapas</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Use um caminho (<code>/resgatar</code>) ou um domínio (<code>checkout.digistore24.com</code>). A última etapa
              conta como conversão.
            </p>
            <ul className="space-y-2">
              {steps.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="w-5 text-muted-foreground">{i + 1}</span>
                  <Input defaultValue={s.name} onBlur={(e) => e.target.value !== s.name && updateStep(s, { name: e.target.value })} />
                  <Input
                    defaultValue={s.url_pattern}
                    onBlur={(e) => e.target.value !== s.url_pattern && updateStep(s, { url_pattern: e.target.value })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Descer">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeStep(s)} aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <form onSubmit={addStep} className="mt-4 flex gap-2">
              <Input placeholder="Nome da etapa" value={newStep.name} onChange={(e) => setNewStep({ ...newStep, name: e.target.value })} required />
              <Input
                placeholder="/caminho ou domínio"
                value={newStep.url_pattern}
                onChange={(e) => setNewStep({ ...newStep, url_pattern: e.target.value })}
                required
              />
              <Button type="submit">Adicionar</Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
