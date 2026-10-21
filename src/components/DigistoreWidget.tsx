import { nativeCheckoutUrl } from "@/lib/checkout";

export function DigistoreWidget({
  productId,
  sessionKey,
  title = "Checkout Digistore24",
  url,
}: {
  productId?: string;
  sessionKey?: string | null;
  title?: string;
  url?: string;
}) {
  // Display the product's existing native order form, without overriding its design.
  const src = url ?? (productId ? nativeCheckoutUrl(productId, sessionKey) : null);
  if (!src) throw new Error("Um produto ou URL do checkout Digistore24 é obrigatório.");
  return (
    <iframe
      title={title}
      src={src}
      className="native-checkout-frame"
      allow="payment *; publickey-credentials-get *"
    />
  );
}
