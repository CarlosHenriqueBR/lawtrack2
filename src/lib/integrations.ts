// Pure helpers for Digistore24 webhooks and the TikTok event queue.

export type SaleStatus = "pending" | "approved" | "refunded" | "chargeback" | "cancelled";

/** Maps a Digistore24 IPN event to our sale status. Unknown events return null (ignored). */
export function digistoreStatus(event: string | undefined | null): SaleStatus | null {
  switch ((event ?? "").toLowerCase()) {
    case "on_payment":
    case "payment":
      return "approved";
    case "on_refund":
    case "refund":
      return "refunded";
    case "on_chargeback":
    case "chargeback":
      return "chargeback";
    case "on_payment_missed":
    case "on_rebill_cancelled":
    case "on_rebill_canceled":
      return "cancelled";
    case "on_payment_pending":
      return "pending";
    default:
      return null;
  }
}

/** Digistore24 IPN signature: SHA-512 of sorted key=value+passphrase pairs (excluding sha_sign). */
export async function digistoreSignature(params: Record<string, string>, passphrase: string) {
  const keys = Object.keys(params)
    .filter((k) => k !== "sha_sign" && k !== "SHASIGN" && params[k] !== "")
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const s = keys.map((k) => `${k}=${params[k]}${passphrase}`).join("");
  const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function timingSafeEqualStr(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Exponential backoff for queue retries: 1m, 2m, 4m, ... capped at 1h. */
export function backoffMs(attempt: number) {
  return Math.min(60 * 60_000, 60_000 * 2 ** Math.max(0, attempt - 1));
}
export const MAX_ATTEMPTS = 6;

/** Next queue state after a failed delivery attempt. */
export function nextFailureState(attempts: number): "retry" | "dead_letter" {
  return attempts >= MAX_ATTEMPTS ? "dead_letter" : "retry";
}

/** Show only the last 4 characters of a token. */
export function maskToken(t: string) {
  return t.length <= 4 ? "••••" : "••••" + t.slice(-4);
}

/** Only real outcomes may be sent to TikTok. */
export const ALLOWED_TIKTOK_EVENTS = ["PageView", "ViewContent", "InitiateCheckout", "AddPaymentInfo", "CompletePayment", "Purchase"] as const;
