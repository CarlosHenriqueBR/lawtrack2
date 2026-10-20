import { describe, expect, it } from "vitest";
import { matchStep, sessionStatus } from "./tracking";

const steps = [
  { id: "a", url_pattern: "/inicio", step_order: 1 },
  { id: "b", url_pattern: "/resgatar", step_order: 2 },
  { id: "d", url_pattern: "checkout.digistore24.com", step_order: 4 },
];

describe("matchStep", () => {
  it("matches a path step", () => {
    expect(matchStep("https://dominio.com/resgatar?utm_source=tt", steps)?.id).toBe("b");
  });
  it("matches a host step", () => {
    expect(matchStep("https://checkout.digistore24.com/product/123", steps)?.id).toBe("d");
  });
  it("returns null for unknown pages", () => {
    expect(matchStep("https://dominio.com/blog", steps)).toBeNull();
  });
});

describe("sessionStatus", () => {
  const now = Date.parse("2026-01-01T12:00:00Z");
  it("is active within 45s", () => {
    expect(sessionStatus(new Date(now - 30_000), false, now)).toBe("active");
  });
  it("is inactive between 45s and 5min", () => {
    expect(sessionStatus(new Date(now - 120_000), false, now)).toBe("inactive");
  });
  it("has left after 5min", () => {
    expect(sessionStatus(new Date(now - 6 * 60_000), false, now)).toBe("left");
  });
  it("converted wins", () => {
    expect(sessionStatus(new Date(now - 6 * 60_000), true, now)).toBe("converted");
  });
});
