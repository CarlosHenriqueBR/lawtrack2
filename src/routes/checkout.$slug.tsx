import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { DigistoreWidget } from "@/components/DigistoreWidget";

const checkoutQuery = (slug: string) => queryOptions({
  queryKey: ["public-checkout", slug],
  queryFn: async () => {
    const { data, error } = await supabase.from("checkout_links").select("title, product_id, orderform_id, funnel_id").eq("slug", slug).eq("enabled", true).maybeSingle();
    if (error) throw new Error("Não foi possível carregar este checkout.");
    return data;
  },
});

export const Route = createFileRoute("/checkout/$slug")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Checkout seguro — Lawtrack" },
    { name: "description", content: "Finalize sua compra na Lawtrack com pagamento processado pela Digistore24." },
    { property: "og:title", content: "Checkout seguro — Lawtrack" },
    { property: "og:description", content: "Finalize sua compra com pagamento seguro Digistore24." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(checkoutQuery(params.slug)),
  component: Checkout,
});

function Checkout() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(checkoutQuery(slug));
  const [session, setSession] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("lt_sid="))?.split("=").slice(1).join("=");
    let sid = qs.get("lt_sid") || (cookie ? decodeURIComponent(cookie) : null);
    if (data?.funnel_id && !sid) sid = `s${crypto.randomUUID().replaceAll("-", "").slice(0, 15)}`;
    if (sid && /^[a-zA-Z0-9_-]{1,80}$/.test(sid)) {
      document.cookie = `lt_sid=${encodeURIComponent(sid)};path=/;max-age=1800;SameSite=Lax${location.protocol === "https:" ? ";Secure" : ""}`;
      setSession(sid);
    }
    if (data?.funnel_id) {
      const script = document.createElement("script");
      script.src = "/api/public/tracker.js";
      script.dataset["funnel"] = data.funnel_id;
      document.body.appendChild(script);
      // The tracker is intentionally loaded once for this full checkout visit.
    }
    setReady(true);
  }, [data?.funnel_id]);
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-5 py-5"><div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3"><Logo /><span className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-4 w-4 text-success" />Pagamento seguro</span></div></header>
      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        {data ? <><h1 className="mb-2 break-words font-display text-4xl">{data.title}</h1><p className="mb-8 text-xs text-muted-foreground">Pagamento processado pela Digistore24</p>{ready && <DigistoreWidget productId={data.product_id} orderformId={data.orderform_id} sessionKey={session} />}</> : <><h1 className="font-display text-4xl">Checkout indisponível</h1><p className="mt-3 text-muted-foreground">Este link não existe ou foi desativado. Entre em contato com o vendedor.</p></>}
      </section>
    </main>
  );
}