import { describe, expect, it } from "vitest";
import {
  createLeadKey,
  createTransactionEmail,
  isTransactionEmailFor,
  leadCheckoutUrl,
  originalEmailFromTransactionEmail,
} from "./lead";

describe("checkout lead identifiers", () => {
  it("creates alphanumeric lead keys and transaction emails", () => {
    const key = createLeadKey();
    const transactionEmail = createTransactionEmail("Buyer@example.com");

    expect(key).toMatch(/^L[a-f0-9]{32}$/);
    expect(transactionEmail).toMatch(/^buyer[a-z]@example\.com$/);
    expect(isTransactionEmailFor("buyer@example.com", transactionEmail)).toBe(true);
    expect(originalEmailFromTransactionEmail(transactionEmail)).toBe("buyer@example.com");
  });

  it("avoids suffixes already taken for the same email", () => {
    const existing = new Set(["buyerx@example.com"]);
    const transactionEmail = createTransactionEmail("buyer@example.com", existing);

    expect(transactionEmail).not.toBe("buyerx@example.com");
    expect(originalEmailFromTransactionEmail("b@example.com")).toBeNull();
  });

  it("builds the Digistore checkout URL with the transaction email and lead key", () => {
    const url = new URL(
      leadCheckoutUrl("723365", "buyerx@example.com", "L0123456789abcdef0123456789abcdef"),
    );

    expect(url.origin).toBe("https://www.checkout-ds24.com");
    expect(url.searchParams.get("email")).toBe("buyerx@example.com");
    expect(url.searchParams.get("custom")).toBe("L0123456789abcdef0123456789abcdef");
  });

  it("rejects invalid Digistore product identifiers", () => {
    expect(() =>
      leadCheckoutUrl("1/../../evil", "buyerx@example.com", "L0123456789abcdef0123456789abcdef"),
    ).toThrow();
  });
});
