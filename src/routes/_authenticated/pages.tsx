import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchFunnels } from "@/lib/data";
import { contentTypeFor, isHtml, safePath, siteSlug } from "@/lib/sites";

type Site = Tables<"hosted_sites">;
type HostedFile = Tables<"hosted_files">;

export const Route = createFileRoute("/_authenticated/pages")({
  head: () => ({
    meta: [
      { title: "Páginas — Lawtrack" },
      { name: "description", content: "Hospede páginas HTML e faça testes A/B por parâmetro na URL." },
      { property: "og:title", content: "Páginas — Lawtrack" },
      { property: "og:description", content: "Hospede páginas HTML e faça testes A/B por parâmetro na URL." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pages,
});

async function fetchSites() {
  const { data, error } = await supabase.from("hosted_sites").select("*").order("created_at");
  if (error) throw error;
  return data;
}

function Pages() {
  const qc = useQueryClient();
  const sites = useQuery({ queryKey: ["hosted-sites"], queryFn: fetchSites });
  const [form, setForm] = useState({ name: "", slug: "" });
  const [open, setOpen] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const slug = siteSlug.safeParse(form.slug);
    if (!slug.success) return toast.error(slug.error.issues[0]?.message ?? "Endereço inválido");
    const { data, error } = await supabase
      .from("hosted_sites")
      .insert({ name: form.name, slug: slug.data })
      .select("id")
      .single();
    if (error) return toast.error(error.code === "23505" ? "Esse endereço já existe." : error.message);
    setForm({ name: "", slug: "" });
    setOpen(data.id);
    qc.invalidateQueries({ queryKey: ["hosted-sites"] });
  }

  return (
    <div>
      <PageHeader title="Páginas" sub="Suba suas páginas (HTML, CSS, JS, imagens) e publique em /endereço/.">
        <form onSubmit={create} className="flex flex-wrap gap-2">
          <Input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input placeholder="endereço (ex: oferta1)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
          <Button type="submit">Criar</Button>
        </form>
      </PageHeader>
      <div className="space-y-3">
        {sites.data?.length === 0 && <p className="text-muted-foreground">Nenhuma página ainda.</p>}
        {sites.data?.map((s) => (
          <SiteCard key={s.id} site={s} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} />
        ))}
      </div>
    </div>
  );
}

function SiteCard({ site, open, onToggle }: { site: Site; open: boolean; onToggle: () => void }) {
  const qc = useQueryClient();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const files = useQuery({
    queryKey: ["hosted-files", site.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("hosted_files").select("*").eq("site_id", site.id).order("path");
      if (error) throw error;
      return data;
    },
  });
  const funnels = useQuery({ queryKey: ["funnels"], queryFn: fetchFunnels, enabled: open });
  const [cfg, setCfg] = useState({
    default_page: site.default_page,
    ab_param: site.ab_param ?? "",
    ab_value: site.ab_value ?? "",
    ab_page: site.ab_page ?? "",
    funnel_id: site.funnel_id ?? "",
    enabled: site.enabled,
  });
  const [busy, setBusy] = useState(false);
  const base = `${origin}/${site.slug}/`;
  const htmlFiles = (files.data ?? []).filter((f) => isHtml(f.path));
  const refreshFiles = () => qc.invalidateQueries({ queryKey: ["hosted-files", site.id] });

  async function upload(list: FileList | null, fromFolder: boolean) {
    if (!list?.length) return;
    setBusy(true);
    let ok = 0;
    for (const file of Array.from(list)) {
      const rel = fromFolder ? file.webkitRelativePath.split("/").slice(1).join("/") : file.name;
      const path = safePath(rel);
      if (!path) continue;
      const type = contentTypeFor(path);
      const { error } = await supabase.storage
        .from("sites")
        .upload(`${site.id}/${path}`, file, { upsert: true, contentType: type.split(";")[0] });
      if (error) { toast.error(`${path}: ${error.message}`); continue; }
      await supabase.from("hosted_files").upsert(
        { site_id: site.id, path, size: file.size, content_type: type, updated_at: new Date().toISOString() },
        { onConflict: "site_id,path" },
      );
      ok++;
    }
    setBusy(false);
    toast.success(`${ok} arquivo(s) enviados`);
    refreshFiles();
  }

  async function removeFile(f: HostedFile) {
    if (!confirm(`Apagar ${f.path}?`)) return;
    await supabase.storage.from("sites").remove([`${site.id}/${f.path}`]);
    await supabase.from("hosted_files").delete().eq("id", f.id);
    refreshFiles();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const hasAb = cfg.ab_param.trim() && cfg.ab_page;
    const { error } = await supabase
      .from("hosted_sites")
      .update({
        default_page: cfg.default_page,
        ab_param: hasAb ? cfg.ab_param.trim() : null,
        ab_value: hasAb ? cfg.ab_value.trim() : null,
        ab_page: hasAb ? cfg.ab_page : null,
        funnel_id: cfg.funnel_id || null,
        enabled: cfg.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", site.id);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["hosted-sites"] });
  }

  async function removeSite() {
    if (!confirm(`Apagar "${site.name}" e todos os arquivos?`)) return;
    const { data } = await supabase.from("hosted_files").select("path").eq("site_id", site.id);
    if (data?.length) await supabase.storage.from("sites").remove(data.map((f) => `${site.id}/${f.path}`));
    await supabase.from("hosted_sites").delete().eq("id", site.id);
    qc.invalidateQueries({ queryKey: ["hosted-sites"] });
  }

  const select = "w-full rounded-md border bg-card px-3 py-2";
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onToggle} className="text-left">
          <h2 className="font-display text-2xl">{site.name}</h2>
          <p className="text-muted-foreground">/{site.slug}/ {site.enabled ? "" : "· desativada"}</p>
        </button>
        <Button variant="outline" size="sm" asChild>
          <a href={base} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Abrir</a>
        </Button>
      </div>

      {open && (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Arquivos</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild disabled={busy}>
                <label className="cursor-pointer">
                  <Upload className="mr-1 h-4 w-4" />Enviar arquivos
                  <input type="file" multiple hidden onChange={(e) => { upload(e.target.files, false); e.target.value = ""; }} />
                </label>
              </Button>
              <Button variant="outline" size="sm" asChild disabled={busy}>
                <label className="cursor-pointer">
                  <Upload className="mr-1 h-4 w-4" />Enviar pasta inteira
                  <input
                    type="file"
                    hidden
                    // @ts-expect-error non-standard folder upload attribute
                    webkitdirectory=""
                    onChange={(e) => { upload(e.target.files, true); e.target.value = ""; }}
                  />
                </label>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ao enviar uma pasta, as subpastas (ex.: <code>img/</code>, <code>css/</code>) são mantidas. Enviar um arquivo com o mesmo nome substitui o anterior.
            </p>
            {busy && <p className="text-muted-foreground">Enviando…</p>}
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {files.data?.map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-sm">
                  <a href={base + f.path} target="_blank" rel="noreferrer" className="flex-1 truncate hover:text-primary">{f.path}</a>
                  <span className="text-xs text-muted-foreground">{Math.ceil(f.size / 1024)} KB</span>
                  <Button variant="ghost" size="icon" onClick={() => removeFile(f)} aria-label="Apagar">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={save} className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Página inicial e teste A/B</h3>
            <div className="space-y-1.5">
              <Label>Página padrão (sem o parâmetro)</Label>
              <select className={select} value={cfg.default_page} onChange={(e) => setCfg({ ...cfg, default_page: e.target.value })}>
                {!htmlFiles.some((f) => f.path === cfg.default_page) && <option value={cfg.default_page}>{cfg.default_page}</option>}
                {htmlFiles.map((f) => <option key={f.id} value={f.path}>{f.path}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Parâmetro</Label>
                <Input placeholder="acs" value={cfg.ab_param} onChange={(e) => setCfg({ ...cfg, ab_param: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Valor</Label>
                <Input placeholder="yonkou" value={cfg.ab_value} onChange={(e) => setCfg({ ...cfg, ab_value: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Página quando o parâmetro bater</Label>
              <select className={select} value={cfg.ab_page} onChange={(e) => setCfg({ ...cfg, ab_page: e.target.value })}>
                <option value="">— sem teste A/B —</option>
                {htmlFiles.map((f) => <option key={f.id} value={f.path}>{f.path}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Rastrear no funil</Label>
              <select className={select} value={cfg.funnel_id} onChange={(e) => setCfg({ ...cfg, funnel_id: e.target.value })}>
                <option value="">— não rastrear —</option>
                {funnels.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
              Página no ar
            </label>
            {cfg.ab_param && cfg.ab_page && (
              <p className="rounded-sm bg-muted p-3 text-xs">
                {base}?{cfg.ab_param}={cfg.ab_value} → <b>{cfg.ab_page}</b><br />
                {base} → <b>{cfg.default_page}</b>
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit">Salvar</Button>
              <Button type="button" variant="ghost" onClick={removeSite}>Apagar página</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
