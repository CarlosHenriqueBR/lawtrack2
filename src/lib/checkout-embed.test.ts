import { beforeEach, describe, expect, it } from "vitest";
import { checkoutEmbedSnippet, checkoutPopupScript } from "./checkout-embed";

function install() {
  const script = document.createElement("script");
  script.src = "https://lawtrack2.lovable.app/api/public/checkout-popup.js";
  script.dataset["checkout"] = "ai-agents";
  Object.defineProperty(document, "currentScript", { configurable: true, value: script });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.open = false; } });
  window.eval(checkoutPopupScript);
  return (window as typeof window & { LawtrackCheckout: { open: (slug?: string) => void; close: () => void } }).LawtrackCheckout;
}

describe("external checkout", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    (window as typeof window & { LawtrackCheckout?: unknown }).LawtrackCheckout = undefined;
    document.documentElement.style.overflow = "";
  });
  it("opens the existing checkout without exposing lead data to the host site", () => {
    const popup = install();
    popup.open();
    const host = document.querySelector("dialog > div");
    expect(host?.shadowRoot?.querySelector("iframe")?.src).toBe("https://lawtrack2.lovable.app/checkout/ai-agents?embed=1&skip_lead=1");
    expect(document.querySelector("input")).toBeNull();
    popup.close();
  });
  it("rejects non-checkout paths and external redirect URLs", () => {
    const popup = install();
    popup.open("https://other.example");
    expect(document.querySelector("dialog")).toBeNull();
    expect(() => checkoutEmbedSnippet("https://lawtrack2.lovable.app", "../auth")).toThrow();
  });
  it("opens only one popup and restores page scrolling on close", () => {
    const popup = install();
    document.documentElement.style.overflow = "auto";
    popup.open();
    popup.open();
    expect(document.querySelectorAll("dialog")).toHaveLength(1);
    expect(document.documentElement.style.overflow).toBe("hidden");
    popup.close();
    expect(document.documentElement.style.overflow).toBe("auto");
  });
});