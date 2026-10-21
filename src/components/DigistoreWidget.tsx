import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { widgetUrl } from "@/lib/checkout";

export function DigistoreWidget({ productId, orderformId, sessionKey }: { productId: string; orderformId: string; sessionKey?: string | null }) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Official Digistore24 integration: provider owns payment fields and resizing.
    let disposed = false;
    setLoaded(false);
    setSlow(false);
    if (!document.getElementById("lawtrack-ds24-script")) {
      const script = document.createElement("script");
      script.id = "lawtrack-ds24-script";
      script.src = "https://www.checkout-ds24.com/service/js/orderform_widget.js";
      script.async = true;
      script.onerror = () => { script.remove(); if (!disposed) setSlow(true); };
      document.body.appendChild(script);
    }
    const host = container.current;
    void customElements.whenDefined("my-order-form").then(() => {
      if (disposed || !host) return;
      const url = new URL(widgetUrl(productId, orderformId, sessionKey));
      const widget = document.createElement("my-order-form");
      widget.setAttribute("base-url", url.origin);
      widget.setAttribute("product-id", productId);
      widget.setAttribute("order-form-id", orderformId);
      widget.setAttribute("query", url.searchParams.toString());
      widget.setAttribute("width", "100%");
      host.replaceChildren(widget);
      const iframe = widget.shadowRoot?.querySelector("iframe");
      iframe?.setAttribute("title", "Pagamento seguro Digistore24");
      iframe?.addEventListener("load", () => { if (!disposed) setLoaded(true); }, { once: true });
    });
    const timer = setTimeout(() => setSlow(true), 20000);
    return () => { disposed = true; host?.replaceChildren(); clearTimeout(timer); };
  }, [productId, orderformId, sessionKey, attempt]);
  return (
    <div className="relative w-full">
      {!loaded && <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Carregando pagamento seguro…</div>}
      {slow && !loaded && <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground"><span>O pagamento está demorando para carregar.</span><Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>Recarregar</Button></div>}
      <div ref={container} className="w-full" />
    </div>
  );
}