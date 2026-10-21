import { digistoreId, nativeCheckoutUrl } from "@/lib/checkout";

const TRANSACTION_SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz";

export function createLeadKey() {
  return `L${crypto.randomUUID().replaceAll("-", "")}`;
}

export function createTransactionEmail(
  email: string,
  unavailable: ReadonlySet<string> = new Set(),
) {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 1 || at === normalized.length - 1) throw new Error("E-mail inválido.");

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (local.length >= 64 || normalized.length >= 254) {
    throw new Error("Este e-mail é longo demais para gerar um identificador de transação.");
  }

  const random =
    crypto.getRandomValues(new Uint32Array(1))[0]! % TRANSACTION_SUFFIX_ALPHABET.length;
  for (let offset = 0; offset < TRANSACTION_SUFFIX_ALPHABET.length; offset++) {
    const suffix =
      TRANSACTION_SUFFIX_ALPHABET[(random + offset) % TRANSACTION_SUFFIX_ALPHABET.length]!;
    const candidate = `${local}${suffix}@${domain}`;
    if (!unavailable.has(candidate)) return candidate;
  }
  throw new Error("Não foi possível criar outro identificador para este e-mail.");
}

export function originalEmailFromTransactionEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 2 || at === normalized.length - 1) return null;
  const local = normalized.slice(0, at);
  if (!/[a-z0-9]$/i.test(local)) return null;
  return `${local.slice(0, -1)}${normalized.slice(at)}`;
}

export function isTransactionEmailFor(email: string, transactionEmail: string) {
  const normalized = email.trim().toLowerCase();
  const transaction = transactionEmail.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  const transactionAt = transaction.lastIndexOf("@");
  return (
    at > 0 &&
    transactionAt === at + 1 &&
    transaction.slice(0, at) === normalized.slice(0, at) &&
    /^[a-z0-9]$/i.test(transaction[at] ?? "") &&
    transaction.slice(transactionAt + 1) === normalized.slice(at + 1)
  );
}

export function leadCheckoutUrl(productId: string, email: string, leadKey: string) {
  const url = new URL(nativeCheckoutUrl(digistoreId.parse(productId)));
  url.searchParams.set("email", email);
  url.searchParams.set("custom", leadKey);
  return url.toString();
}
