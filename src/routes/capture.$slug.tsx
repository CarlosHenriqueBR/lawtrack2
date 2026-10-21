import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { CaptureFormView } from "@/components/CaptureFormView";
import { getEmbedAppearance, saveEmbedLead } from "@/lib/embed-capture.functions";
import { embeddedPaymentPath } from "@/lib/embed-capture";

const appearanceQuery = (slug: string) => queryOptions({ queryKey: ["embed-appearance", slug], queryFn: () => getEmbedAppearance({ data: { slug } }) });

export const Route = createFileRoute("/capture/$slug")({
  head: () => ({ meta: [
    { title: "Confirmar email — Checkout Lawtrack" },
    { name: "description", content: "Confirme seu email antes de continuar para o pagamento seguro." },
    { property: "og:title", content: "Confirmar email — Checkout Lawtrack" },
    { property: "og:description", content: "Confirme seu email para continuar sua compra." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(appearanceQuery(params.slug)),
  component: EmbeddedCapture,
});

function EmbeddedCapture() {
  const { slug } = Route.useParams();
  const { data: appearance } = useSuspenseQuery(appearanceQuery(slug));
  const save = useServerFn(saveEmbedLead);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(null);
    try {
      const params = new URLSearchParams(window.location.search);
      const result = await save({ data: { slug, email, sessionKey: params.get("lt_sid"), utms: {
        utm_source: params.get("utm_source"), utm_medium: params.get("utm_medium"), utm_campaign: params.get("utm_campaign"), utm_content: params.get("utm_content"), utm_term: params.get("utm_term"),
      } } });
      const url = new URL(embeddedPaymentPath(slug, result.leadKey), window.location.origin);
      for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "lt_sid"]) {
        const value = params.get(key); if (value) url.searchParams.set(key, value);
      }
      const parentOrigin = params.get("parent_origin");
      if (window.parent !== window && parentOrigin && /^https?:\/\//.test(parentOrigin)) {
        window.parent.postMessage({ type: "lawtrack:lead-saved", url: url.toString() }, new URL(parentOrigin).origin);
      } else window.location.assign(url.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível continuar."); setSaving(false);
    }
  }
  return <main className="native-checkout"><CaptureFormView appearance={appearance} email={email} onEmailChange={setEmail} onSubmit={submit} saving={saving} error={error} /></main>;
}