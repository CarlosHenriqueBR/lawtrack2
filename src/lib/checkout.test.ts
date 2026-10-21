import { describe, expect, it } from "vitest";
import { checkoutSchema, nativeCheckoutUrl, unwrapDigistore, widgetUrl } from "./checkout";

describe("Digistore24 checkout", () => {
  it("uses the product's native form without a widget override", () => {
    expect(nativeCheckoutUrl("723365")).toBe("https://www.checkout-ds24.com/product/723365/");
  });
  it("keeps attribution on the native form", () => {
    expect(new URL(nativeCheckoutUrl("723365", "s123456")).searchParams.get("custom")).toBe("s123456");
  });
  it("embeds the official checkout, without editor mode", () => {
    const url = new URL(widgetUrl("723365", "252970"));
    expect(url.origin).toBe("https://www.checkout-ds24.com");
    expect(url.pathname).toBe("/product/723365/252970");
    expect(url.searchParams.has("editor_mode")).toBe(false);
  });
  it("preserves the session in the IPN custom field", () => {
    expect(new URL(widgetUrl("723365", "252970", "s123456")).searchParams.get("custom")).toBe("s123456");
  });
  it("rejects URL injection in product IDs", () => {
    expect(() => widgetUrl("1/../../evil", "123")).toThrow();
  });
  it("requires a valid shareable link slug", () => {
    expect(checkoutSchema.safeParse({ title: "Curso", slug: "../admin", productId: "1", orderformId: "2", funnelId: null }).success).toBe(false);
  });
  it("rejects API failures even with a successful HTTP status", () => {
    expect(() => unwrapDigistore({ result: "error", code: 5 })).toThrow();
    expect(unwrapDigistore({ result: "success", data: { products: [] } })).toEqual({ products: [] });
  });
});