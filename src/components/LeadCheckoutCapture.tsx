import { useState, type FormEvent } from "react";
import { createLeadKey, createTransactionEmail, leadCheckoutUrl } from "@/lib/lead";
import { DigistoreWidget } from "@/components/DigistoreWidget";
import { CaptureFormView } from "@/components/CaptureFormView";
import { resolveCaptureAppearance } from "@/lib/capture-appearance";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export function LeadCheckoutCapture({
  productId,
  sessionKey,
  appearance,
  embed = false,
}: {
  productId: string;
  sessionKey: string | null;
  appearance?: unknown;
  embed?: boolean;
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

        setCheckoutUrl(leadCheckoutUrl(productId, transactionEmail, leadKey));
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

  return <CaptureFormView appearance={resolveCaptureAppearance(appearance)} email={email} onEmailChange={setEmail} onSubmit={submitLead} saving={saving} error={error} popup={embed} />;
}
