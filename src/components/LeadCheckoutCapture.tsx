import { useState, type FormEvent } from "react";
import { createLeadKey, createTransactionEmail, leadCheckoutUrl } from "@/lib/lead";
import { DigistoreWidget } from "@/components/DigistoreWidget";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export function LeadCheckoutCapture({
  productId,
  sessionKey,
}: {
  productId: string;
  sessionKey: string | null;
}) {
  const [email, setEmail] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const originalEmail = email.trim().toLowerCase();
    const leadKey = createLeadKey();
    const params = new URLSearchParams(window.location.search);
    const utms = Object.fromEntries(UTM_KEYS.map((key) => [key, params.get(key)]));
    const unavailable = new Set<string>();

    setSaving(true);
    setError(null);
    try {
      for (let attempt = 0; attempt < 26; attempt++) {
        const transactionEmail = createTransactionEmail(originalEmail, unavailable);
        const response = await fetch("/api/public/save-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: originalEmail,
            transactionEmail,
            leadKey,
            sessionKey,
            utms,
          }),
        });
        const result: { error?: string } = await response.json();
        if (response.status === 409 && result.error === "transaction_email_conflict") {
          unavailable.add(transactionEmail);
          continue;
        }
        if (!response.ok) {
          throw new Error(
            "Não foi possível salvar seus dados. Verifique sua conexão e tente novamente.",
          );
        }

        // Digistore24 always receives the buyer's real email; the lead key links the sale.
        setCheckoutUrl(leadCheckoutUrl(productId, originalEmail, leadKey));
        return;
      }
      throw new Error("Não foi possível gerar um identificador exclusivo para este e-mail.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Ocorreu um erro ao validar seu acesso. Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (checkoutUrl) {
    return <DigistoreWidget title="Checkout Digistore24" url={checkoutUrl} />;
  }

  return (
    <section className="mx-auto flex min-h-[70dvh] max-w-xl flex-col justify-center px-6 py-12">
      <h1 className="font-display text-center text-4xl">Continue para o pagamento</h1>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Informe seu e-mail para validar o acesso. O checkout seguro da Digistore24 será carregado em
        seguida.
      </p>
      <form className="mx-auto mt-8 w-full max-w-md space-y-4" onSubmit={submitLead}>
        <label htmlFor="lead-email" className="block text-sm font-medium">
          E-mail
        </label>
        <input
          id="lead-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(change) => setEmail(change.target.value)}
          disabled={saving}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          placeholder="voce@exemplo.com"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? "Validando..." : "Continuar para pagamento"}
        </button>
      </form>
    </section>
  );
}
