import { nativeCheckoutUrl } from "@/lib/checkout";

export function DigistoreWidget({ productId, sessionKey }: { productId: string; sessionKey?: string | null }) {
  // Display the product's existing native order form, without overriding its design.
  return <iframe title="Checkout Digistore24" src={nativeCheckoutUrl(productId, sessionKey)} className="native-checkout-frame" allow="payment *; publickey-credentials-get *" />;
}