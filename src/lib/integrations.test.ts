import { describe, expect, it } from "vitest";
import { backoffMs, digistoreSignature, digistoreStatus, maskToken, nextFailureState } from "./integrations";

describe("digistoreStatus", () => {
  it("only on_payment is approved", () => {
    expect(digistoreStatus("on_payment")).toBe("approved");
    expect(digistoreStatus("on_refund")).toBe("refunded");
    expect(digistoreStatus("on_chargeback")).toBe("chargeback");
    expect(digistoreStatus("connection_test")).toBeNull();
  });
});

describe("queue retry", () => {
  it("backs off exponentially", () => {
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(3)).toBe(240_000);
    expect(backoffMs(20)).toBe(3_600_000);
  });
  it("dead-letters after 6 attempts", () => {
    expect(nextFailureState(5)).toBe("retry");
    expect(nextFailureState(6)).toBe("dead_letter");
  });
});

describe("signature", () => {
  it("changes when the payload changes", async () => {
    const a = await digistoreSignature({ order_id: "1", amount: "10" }, "pw");
    const b = await digistoreSignature({ order_id: "1", amount: "11" }, "pw");
    expect(a).toHaveLength(128);
    expect(a).not.toBe(b);
  });
});

it("masks tokens", () => {
  expect(maskToken("abcdef123456")).toBe("••••3456");
});
