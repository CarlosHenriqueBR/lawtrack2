import { useState } from "react";
import { Code, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { checkoutEmbedSnippet } from "@/lib/checkout-embed";

export function CheckoutEmbedDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const snippet = checkoutEmbedSnippet("https://lawtrack2.lovable.app", slug);
  return <Dialog open={open} onOpenChange={setOpen}>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Code />Usar no meu site</Button>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Janela no seu site</DialogTitle></DialogHeader>
      <Label htmlFor={`embed-${slug}`}>Código HTML</Label>
      <Textarea id={`embed-${slug}`} readOnly value={snippet} rows={6} className="font-mono text-xs" />
      <Button onClick={async () => {
        try { await navigator.clipboard.writeText(snippet); toast.success("Código copiado"); }
        catch { toast.error("Não foi possível copiar o código"); }
      }}><Copy />Copiar código</Button>
    </DialogContent>
  </Dialog>;
}