import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, ExternalLink, Plus, RefreshCw, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fetchFunnels } from "@/lib/data";
import { createCheckoutWidget, getCheckoutCatalog, saveCheckoutLink } from "@/lib/checkout.functions";
import { checkoutSchema, trackingSchema } from "@/lib/checkout";
import { Textarea } from "@/components/ui/textarea";
import { CaptureAppearanceEditor } from "@/components/CaptureAppearanceEditor";

export const Route = createFileRoute("/_authenticated/checkouts")({
  head: () => ({ meta: [
    { title: "Checkouts Digistore24 — Lawtrack" },
    { name: "description", content: "Gerencie links de compra e formulários de pagamento Digistore24 na Lawtrack." },
    { property: "og:title", content: "Checkouts Digistore24 — Lawtrack" },
    { property: "og:description", content: "Produtos e links de checkout integrado da Lawtrack." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Checkouts,
});

function Checkouts() {
  const qc = useQueryClient();
  const fetchCatalog = useServerFn(getCheckoutCatalog);
  const createWidget = useServerFn(createCheckoutWidget);
  const saveLink = useServerFn(saveCheckoutLink);
  const catalog = useQuery({ queryKey: ["checkout-catalog"], queryFn: () => fetchCatalog(), retry: false });
  const links = useQuery({ queryKey: ["checkout-links"], queryFn: async () => {
    const { data, error } = await supabase.from("checkout_links").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  } });
  const funnels = useQuery({ queryKey: ["funnels"], queryFn: fetchFunnels });
  const [productId, setProduct] = useState("");
  const [orderformId, setOrderform] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [funnelId, setFunnel] = useState("");
  const [widgetName, setWidgetName] = useState("Lawtrack Checkout");
  const [steps, setSteps] = useState(2);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showWidget, setShowWidget] = useState(false);
  const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground";

  async function addWidget() {
    setCreating(true);
    try {
      const result = await createWidget({ data: { name: widgetName, steps } });
      await qc.invalidateQueries({ queryKey: ["checkout-catalog"] });
      setOrderform(result.id);
      setShowWidget(false);
      toast.success("Formulário criado na Digistore24");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar o formulário"); }
    finally { setCreating(false); }
  }

  async function addLink(event: React.FormEvent) {
    event.preventDefault();
    const result = checkoutSchema.safeParse({ title, slug, productId, orderformId, funnelId: funnelId || null });
    if (!result.success) { toast.error(result.error.issues[0]?.message ?? "Confira os campos"); return; }
    setSaving(true);
    try {
      await saveLink({ data: result.data });
      await qc.invalidateQueries({ queryKey: ["checkout-links"] });
      setSlug("");
      toast.success("Link de checkout criado");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar"); }
    finally { setSaving(false); }
  }

  async function toggle(id: string, enabled: boolean) {
    const { error } = await supabase.from("checkout_links").update({ enabled }).eq("id", id);
    if (error) toast.error("Não foi possível alterar o link");
    else qc.invalidateQueries({ queryKey: ["checkout-links"] });
  }

  return (
    <div>
      <PageHeader title="Checkouts"><Button variant="outline" onClick={() => catalog.refetch()} disabled={catalog.isFetching}><RefreshCw className={catalog.isFetching ? "animate-spin motion-reduce:animate-none" : ""} />Atualizar produtos</Button></PageHeader>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section>
          <h2 className="mb-5 flex items-center gap-2 font-display text-2xl"><CreditCard className="h-5 w-5 text-primary" />Novo link de compra</h2>
          {catalog.isPending && <p className="py-4 text-muted-foreground">Buscando produtos na Digistore24…</p>}
          {catalog.error && <p role="alert" className="mb-4 text-destructive">{catalog.error.message}</p>}
          <form onSubmit={addLink} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="checkout-product">Produto</Label><select id="checkout-product" className={selectClass} value={productId} onChange={(e) => { setProduct(e.target.value); const product = catalog.data?.products.find((p) => p.id === e.target.value); if (product) setTitle(product.name); }} required><option value="">Selecione um produto</option>{catalog.data?.products.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="checkout-form">Formulário Digistore24</Label><select id="checkout-form" className={selectClass} value={orderformId} onChange={(e) => setOrderform(e.target.value)} required><option value="">Selecione um formulário incorporável</option>{catalog.data?.orderforms.map((f) => <option value={f.id} key={f.id}>{f.name}</option>)}</select><Button type="button" size="sm" variant="outline" onClick={() => setShowWidget(!showWidget)} disabled={!catalog.data}><Plus />Criar formulário</Button></div>
            {showWidget && <div className="space-y-3 border-y py-4"><Label htmlFor="widget-name">Nome do formulário</Label><Input id="widget-name" value={widgetName} maxLength={63} onChange={(e) => setWidgetName(e.target.value)} /><Label htmlFor="widget-steps">Etapas</Label><select id="widget-steps" className={selectClass} value={steps} onChange={(e) => setSteps(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n} {n === 1 ? "etapa" : "etapas"}</option>)}</select><Button type="button" onClick={addWidget} disabled={creating || !widgetName.trim()}>{creating ? "Criando…" : "Criar na Digistore24"}</Button></div>}
            <div className="space-y-2"><Label htmlFor="checkout-title">Título da compra</Label><Input id="checkout-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required /></div>
            <div className="space-y-2"><Label htmlFor="checkout-slug">Endereço do link</Label><div className="text-xs text-muted-foreground">lawtrack2.lovable.app/checkout/</div><Input id="checkout-slug" placeholder="meu-produto" value={slug} onChange={(e) => setSlug(e.target.value)} required minLength={3} maxLength={80} pattern="[a-z0-9][a-z0-9-]{2,79}" /></div>
            <div className="space-y-2"><Label htmlFor="checkout-funnel">Funil</Label><select id="checkout-funnel" className={selectClass} value={funnelId} onChange={(e) => setFunnel(e.target.value)}><option value="">Sem vínculo</option>{funnels.data?.map((f) => <option value={f.id} key={f.id}>{f.name}</option>)}</select></div>
            <Button type="submit" disabled={saving || !productId || !orderformId}><Plus />{saving ? "Salvando…" : "Criar link"}</Button>
          </form>
        </section>
        <section className="min-w-0">
          <h2 className="mb-5 font-display text-2xl">Links de checkout</h2>
          {links.isPending && <p className="text-muted-foreground">Carregando links…</p>}
          {links.error && <p role="alert" className="text-destructive">Não foi possível carregar os links.</p>}
          {links.data?.length === 0 && <div className="border-y py-12 text-center text-muted-foreground">Nenhum checkout criado.</div>}
          <div className="space-y-4">{links.data?.map((link) => <article key={link.id} className="rounded-md border bg-card p-5"><div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words text-base">{link.title}</h3><Switch aria-label={`Ativar ${link.title}`} checked={link.enabled} onCheckedChange={(v) => toggle(link.id, v)} /></div><p className="my-3 break-all text-xs text-muted-foreground">lawtrack2.lovable.app/checkout/{link.slug}</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(`https://lawtrack2.lovable.app/checkout/${link.slug}`); toast.success("Link copiado"); } catch { toast.error("Não foi possível copiar"); } }}><Copy />Copiar link</Button><Button variant="ghost" size="sm" asChild><Link to="/checkout/$slug" params={{ slug: link.slug }} target="_blank"><ExternalLink />Abrir checkout</Link></Button><CaptureAppearanceEditor link={link} /><TrackingEditor link={link} /><span className={`self-center text-xs ${link.enabled ? "text-success" : "text-muted-foreground"}`}>{link.enabled ? "Ativo" : "Desativado"}</span></div></article>)}</div>
        </section>
      </div>
    </div>
  );
}
function TrackingEditor({ link }: { link: { id: string; tiktok_pixel_id: string | null; custom_script: string | null } }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pixel, setPixel] = useState(link.tiktok_pixel_id ?? "");
  const [script, setScript] = useState(link.custom_script ?? "");
  const [saving, setSaving] = useState(false);
  async function save() {
    const parsed = trackingSchema.safeParse({ tiktokPixelId: pixel.trim() || null, customScript: script.trim() || null });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Confira os campos"); return; }
    setSaving(true);
    const { error } = await supabase.from("checkout_links").update({ tiktok_pixel_id: parsed.data.tiktokPixelId, custom_script: parsed.data.customScript }).eq("id", link.id);
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar os scripts"); return; }
    await qc.invalidateQueries({ queryKey: ["checkout-links"] });
    toast.success("Rastreamento salvo");
    setOpen(false);
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>Rastreamento</Button>
      {open && <div className="mt-3 w-full space-y-3 border-t pt-4">
        <div className="space-y-2"><Label htmlFor={`px-${link.id}`}>ID do pixel do TikTok</Label><Input id={`px-${link.id}`} placeholder="C1A2B3C4D5E6F7G8H9" value={pixel} onChange={(e) => setPixel(e.target.value)} maxLength={40} /></div>
        <div className="space-y-2"><Label htmlFor={`sc-${link.id}`}>Script próprio</Label><Textarea id={`sc-${link.id}`} rows={6} className="font-mono text-xs" placeholder={"<script>...</script>"} value={script} onChange={(e) => setScript(e.target.value)} /><p className="text-xs text-muted-foreground">Roda na página do checkout. Não tem acesso aos campos do formulário da Digistore24.</p></div>
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
      </div>}
    </>
  );
}
