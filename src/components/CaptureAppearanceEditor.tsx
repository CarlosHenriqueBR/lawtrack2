import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Paintbrush, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { CaptureFormView } from "@/components/CaptureFormView";
import { captureAppearanceSchema, defaultCaptureAppearance, resolveCaptureAppearance, type CaptureAppearance } from "@/lib/capture-appearance";

const textFields = [
  ["title", "Título", 160], ["subtitle", "Subtítulo", 240],
  ["emailLabel", "Nome do campo", 80], ["placeholder", "Exemplo de email", 120], ["buttonText", "Texto do botão", 100],
] as const;
const colorFields = [
  ["background", "Fundo da página"], ["surface", "Fundo da janela"], ["text", "Texto e título"],
  ["secondaryText", "Descrição"], ["button", "Botão"], ["buttonTextColor", "Texto do botão"],
  ["inputBackground", "Campo de email"], ["border", "Bordas"],
] as const;

export function CaptureAppearanceEditor({ link }: { link: { id: string; title: string; capture_appearance: unknown } }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [appearance, setAppearance] = useState(() => resolveCaptureAppearance(link.capture_appearance));
  const [saving, setSaving] = useState(false);
  function change<K extends keyof CaptureAppearance>(key: K, value: CaptureAppearance[K]) {
    setAppearance((current) => ({ ...current, [key]: value }));
  }
  async function save() {
    const parsed = captureAppearanceSchema.safeParse(appearance);
    if (!parsed.success) { toast.error("Confira os textos e as cores."); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("checkout_links").update({ capture_appearance: parsed.data }).eq("id", link.id).select("id").single();
      if (error || !data) throw new Error("Não foi possível salvar a aparência.");
      await qc.invalidateQueries({ queryKey: ["checkout-links"] });
      await qc.invalidateQueries({ queryKey: ["public-checkout"] });
      toast.success("Aparência salva"); setOpen(false);
    } catch { toast.error("Não foi possível salvar a aparência."); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={(value) => {
    if (saving) return;
    if (value) setAppearance(resolveCaptureAppearance(link.capture_appearance));
    setOpen(value);
  }}>
    <DialogTrigger asChild><Button variant="outline" size="sm"><Paintbrush />Personalizar janela</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto">
      <DialogHeader><DialogTitle className="break-words pr-6">Personalizar janela — {link.title}</DialogTitle></DialogHeader>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-3">
            <h3 className="font-medium">Textos</h3>
            {textFields.slice(0, 2).map(([key, label, max]) => <div key={key} className="space-y-2"><Label htmlFor={`capture-${key}`}>{label}</Label><Input id={`capture-${key}`} value={appearance[key]} maxLength={max} onChange={(event) => change(key, event.target.value)} /></div>)}
            <div className="space-y-2"><Label htmlFor="capture-description">Descrição</Label><Textarea id="capture-description" value={appearance.description} maxLength={600} rows={3} onChange={(event) => change("description", event.target.value)} /></div>
            {textFields.slice(2).map(([key, label, max]) => <div key={key} className="space-y-2"><Label htmlFor={`capture-${key}`}>{label}</Label><Input id={`capture-${key}`} value={appearance[key]} maxLength={max} onChange={(event) => change(key, event.target.value)} /></div>)}
          </section>
          <section className="space-y-3 border-t pt-4">
            <h3 className="font-medium">Cores</h3>
            <div className="grid grid-cols-2 gap-3">{colorFields.map(([key, label]) => <div className="space-y-2" key={key}>
              <Label htmlFor={`capture-${key}`} className="text-xs">{label}</Label>
              <Input type="color" id={`capture-${key}`} aria-label={label} className="h-10 w-full cursor-pointer p-1" value={appearance[key]} onChange={(event) => change(key, event.target.value)} />
            </div>)}</div>
          </section>
          <section className="space-y-4 border-t pt-4">
            <h3 className="font-medium">Design</h3>
            <div className="space-y-2"><Label htmlFor="capture-layout">Formato</Label><Select value={appearance.layout} onValueChange={(value) => { if (value === "plain" || value === "panel") change("layout", value); }}><SelectTrigger id="capture-layout"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="plain">Sem moldura</SelectItem><SelectItem value="panel">Janela com borda</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="capture-alignment">Alinhamento</Label><Select value={appearance.alignment} onValueChange={(value) => { if (value === "left" || value === "center") change("alignment", value); }}><SelectTrigger id="capture-alignment"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="center">Centralizado</SelectItem><SelectItem value="left">À esquerda</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="capture-font">Fonte do título</Label><Select value={appearance.titleFont} onValueChange={(value) => { if (value === "serif" || value === "mono" || value === "sans") change("titleFont", value); }}><SelectTrigger id="capture-font"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="serif">Clássica</SelectItem><SelectItem value="mono">Monoespaçada</SelectItem><SelectItem value="sans">Sem serifa</SelectItem></SelectContent></Select></div>
            <div className="space-y-3"><Label>Arredondamento · {appearance.radius}px</Label><Slider aria-label="Arredondamento" value={[appearance.radius]} min={0} max={8} step={1} onValueChange={([value]) => { if (value !== undefined) change("radius", value); }} /></div>
            <div className="space-y-3"><Label>Largura · {appearance.width}px</Label><Slider aria-label="Largura" value={[appearance.width]} min={360} max={640} step={8} onValueChange={([value]) => { if (value !== undefined) change("width", value); }} /></div>
          </section>
        </div>
        <section className="min-w-0 lg:sticky lg:top-0 lg:self-start">
          <h3 className="mb-3 font-medium">Prévia</h3>
          <div className="overflow-hidden rounded-md border"><CaptureFormView appearance={appearance} preview /></div>
        </section>
      </div>
      <div className="sticky bottom-0 flex flex-wrap justify-between gap-2 border-t bg-background pt-4">
        <Button variant="ghost" disabled={saving} onClick={() => setAppearance({ ...defaultCaptureAppearance })}><RotateCcw />Restaurar padrão</Button>
        <div className="flex gap-2"><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={saving} onClick={save}><Save />{saving ? "Salvando…" : "Salvar aparência"}</Button></div>
      </div>
    </DialogContent>
  </Dialog>;
}