import { describe, expect, it } from "vitest";
import { attributeSale, newAccounts, statusOf, summarize, type AdAccount, type CampaignStat } from "./ads";

const accounts: AdAccount[] = [
  { advertiser_id: "A1", bc_id: "b", name: "Conta 1", currency: "USD", enabled: true, domains: ["loja1.com"] },
  { advertiser_id: "A2", bc_id: "b", name: "Conta 2", currency: "BRL", enabled: true, domains: [] },
];
const stats: CampaignStat[] = [
  { advertiser_id: "A1", campaign_id: "111", campaign_name: "Black", spend: 100, impressions: 10000, clicks: 200, conversions: 3 },
  { advertiser_id: "A2", campaign_id: "222", campaign_name: "Teste", spend: 300, impressions: 5000, clicks: 50, conversions: 0 },
];
const rates = { BRL: 1, USD: 5, EUR: 6 };

describe("ads ROI", () => {
  it("links a sale to the account by campaign id, then by campaign name", () => {
    expect(attributeSale({ amount: 1, currency: "BRL", utm_campaign: "111" }, stats, accounts)?.advertiser_id).toBe("A1");
    expect(attributeSale({ amount: 1, currency: "BRL", tt_campaign: "teste" }, stats, accounts)?.advertiser_id).toBe("A2");
  });
  it("falls back to the account domain when the campaign is unknown", () => {
    expect(attributeSale({ amount: 1, currency: "BRL", landing_url: "https://www.loja1.com/x" }, stats, accounts)?.advertiser_id).toBe("A1");
    expect(attributeSale({ amount: 1, currency: "BRL", landing_url: "https://outra.com" }, stats, accounts)).toBeNull();
  });
  it("converts mixed currencies to BRL and computes profit and ROI", () => {
    const r = summarize(accounts, stats, [{ amount: 200, currency: "EUR", utm_campaign: "111" }], rates);
    const a1 = r.accounts.find((a) => a.account.advertiser_id === "A1")!;
    expect(a1.spend).toBe(500); // 100 USD
    expect(a1.revenue).toBe(1200); // 200 EUR
    expect(a1.profit).toBe(700);
    expect(a1.roi).toBeCloseTo(1.4);
    expect(statusOf(a1)).toBe("lucro");
    const a2 = r.accounts.find((a) => a.account.advertiser_id === "A2")!;
    expect(statusOf(a2)).toBe("sem_venda");
    expect(r.total.profit).toBe(400);
  });
  it("marks an account as loss when sales do not cover spend", () => {
    const r = summarize(accounts, stats, [{ amount: 100, currency: "BRL", utm_campaign: "222" }], rates);
    expect(statusOf(r.accounts.find((a) => a.account.advertiser_id === "A2")!)).toBe("prejuizo");
  });
  it("registers accounts a BM gained after it was connected, without repeating known ones", () => {
    const found = [
      { advertiser_id: "A3", name: "Conta nova" },
      { advertiser_id: "A1", name: "Conta 1" },
      { advertiser_id: "A3", name: "repetida" },
      { advertiser_id: "   ", name: null },
    ];
    expect(newAccounts(found, ["A1", "A2"])).toEqual([{ advertiser_id: "A3", name: "Conta nova" }]);
  });
});
