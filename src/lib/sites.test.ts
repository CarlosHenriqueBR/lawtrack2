import { describe, expect, it } from "vitest";
import { injectTracker, pickEntryPage, safePath, siteSlug } from "./sites";

const site = { default_page: "b.html", ab_param: "acs", ab_value: "yonkou", ab_page: "teste1.html" };

describe("A/B entry page", () => {
  it("serves the test page when ?acs=yonkou", () => {
    expect(pickEntryPage(site, new URLSearchParams("acs=yonkou"))).toBe("teste1.html");
  });
  it("serves the default page without the flag", () => {
    expect(pickEntryPage(site, new URLSearchParams(""))).toBe("b.html");
  });
  it("serves the default page when the flag has another value", () => {
    expect(pickEntryPage(site, new URLSearchParams("acs=outro"))).toBe("b.html");
  });
});

describe("paths and slugs", () => {
  it("blocks path traversal", () => {
    expect(safePath("../secret")).toBeNull();
    expect(safePath("img/%2e%2e/x")).toBeNull();
    expect(safePath("img/logo.png")).toBe("img/logo.png");
  });
  it("rejects app-reserved slugs", () => {
    expect(siteSlug.safeParse("dashboard").success).toBe(false);
    expect(siteSlug.safeParse("minha-oferta").success).toBe(true);
  });
  it("injects the tracker before </head>", () => {
    expect(injectTracker("<head></head>", "https://x", "f1")).toContain('data-funnel="f1" defer></script></head>');
  });
});
