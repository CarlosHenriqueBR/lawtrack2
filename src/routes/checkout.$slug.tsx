import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LeadCheckoutCapture } from "@/components/LeadCheckoutCapture";
import { CheckoutTracking } from "@/components/CheckoutTracking";

const checkoutQuery = (slug: string) => queryOptions({
  queryKey: ["public-checkout", slug],
  queryFn: async () => {
    const { data, error } = await supabase.from("checkout_links").select("title, product_id, orderform_id, funnel_id, tiktok_pixel_id, custom_script, capture_appearance").eq("slug", slug).eq("enabled", true).maybeSingle();
    if (error) throw new Error("Não foi possível carregar este checkout.");
    return data;
  },
});

export const Route = createFileRoute("/checkout/$slug")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Checkout seguro — Digistore24" },
    { name: "description", content: "Finalize sua compra com pagamento processado pela Digistore24." },
    { property: "og:title", content: "Checkout seguro — Digistore24" },
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
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    setEmbedded(qs.get("embed") === "1");
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
    <main className="native-checkout">
      {data && <CheckoutTracking tiktokPixelId={data.tiktok_pixel_id} customScript={data.custom_script} />}
      {data ? ready && <LeadCheckoutCapture productId={data.product_id} sessionKey={session} appearance={data.capture_appearance} embed={embedded} /> : <section className="p-8"><h1 className="font-display text-4xl">Checkout indisponível</h1><p className="mt-3">Este link não existe ou foi desativado. Entre em contato com o vendedor.</p></section>}
    </main>
  );
}