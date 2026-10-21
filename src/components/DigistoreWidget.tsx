import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { widgetUrl } from "@/lib/checkout";

export function DigistoreWidget({ productId, orderformId, sessionKey }: { productId: string; orderformId: string; sessionKey?: string | null }) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    // Official Digistore24 integration: provider owns payment fields and resizing.
    Object.assign(window, { DS24_ORIGIN: "https://www.digistore24.com" });
    const script = document.createElement("script");
    script.src = "https://www.digistore24.com/service/js/orderform_widget.js";
    script.async = true;
    document.body.appendChild(script);
    const timer = setTimeout(() => setSlow(true), 20000);
    return () => { script.remove(); clearTimeout(timer); };
  }, []);
  return (
    <div className="relative w-full">
      {!loaded && <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Carregando pagamento seguro…</div>}
      {slow && <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground"><span>Se o formulário não aparecer, tente carregar novamente.</span><Button size="sm" variant="outline" onClick={() => { setAttempt((n) => n + 1); setLoaded(false); }}>Recarregar</Button></div>}
      <iframe key={attempt} id="ds24_payIFrame" title="Pagamento seguro Digistore24" src={widgetUrl(productId, orderformId, sessionKey)} className="checkout-widget w-full border-0" allow="payment" onLoad={() => setLoaded(true)} />
    </div>
  );
}