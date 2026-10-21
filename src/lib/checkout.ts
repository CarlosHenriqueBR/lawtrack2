import { z } from "zod";

export const digistoreId = z.string().regex(/^[0-9]{1,20}$/, "ID inválido");
export const checkoutSchema = z.object({
  title: z.string().trim().min(1).max(160),
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{2,79}$/, "Use 3 a 80 letras minúsculas, números ou hífens"),
  productId: digistoreId,
  orderformId: digistoreId,
  funnelId: z.string().uuid().nullable(),
});

export function widgetUrl(productId: string, orderformId: string, sessionKey?: string | null) {
  const url = new URL(`https://www.checkout-ds24.com/product/${digistoreId.parse(productId)}/${digistoreId.parse(orderformId)}`);
  if (sessionKey && /^[A-Za-z0-9 .\,~_-]{1,1023}$/.test(sessionKey)) url.searchParams.set("custom", sessionKey);
  return url.toString();
}

export function nativeCheckoutUrl(productId: string, sessionKey?: string | null) {
  const url = new URL(`https://www.checkout-ds24.com/product/${digistoreId.parse(productId)}/`);
  if (sessionKey && /^[A-Za-z0-9 .\,~_-]{1,1023}$/.test(sessionKey)) url.searchParams.set("custom", sessionKey);
  return url.toString();
}

export function unwrapDigistore(value: unknown): Record<string, unknown> {
  const envelope = z.object({ result: z.string().optional(), status: z.string().optional(), data: z.unknown().optional() }).passthrough().parse(value);
  if (envelope.result !== "success") throw new Error("A Digistore24 recusou a operação. Confira a chave e as permissões da conta.");
  return z.record(z.string(), z.unknown()).parse(envelope.data);
}

export function catalogRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const parsed = z.object({ id: z.union([z.string(), z.number()]), name: z.string() }).safeParse(row);
    if (!parsed.success || !digistoreId.safeParse(String(parsed.data.id)).success) return [];
    return [{ id: String(parsed.data.id), name: parsed.data.name }];
  });
}