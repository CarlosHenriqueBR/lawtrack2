import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, chain } = vi.hoisted(() => {
  const chain = { select: vi.fn(), order: vi.fn(), ilike: vi.fn(), range: vi.fn() };
  return { db: { from: vi.fn(() => chain) }, chain };
});
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: db }));
import { listCheckoutLeads } from "./admin.functions";

const read = listCheckoutLeads as unknown as (args: { data: { page: number; search: string }; context: { userId: string; supabase: { rpc: ReturnType<typeof vi.fn> } } }) => Promise<unknown>;

describe("read-only lead monitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chain.select.mockReturnValue(chain); chain.order.mockReturnValue(chain); chain.ilike.mockReturnValue(chain);
    chain.range.mockResolvedValue({ data: [{ email: "buyer@example.com", transaction_email: "buyerx@example.com" }], count: 1, error: null });
  });
  it("reads saved emails unchanged without a write operation", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: true }).mockResolvedValueOnce({ data: 3 });
    expect(await read({ data: { page: 0, search: "" }, context: { userId: "manager", supabase: { rpc } } })).toEqual({ rows: [{ email: "buyer@example.com", transaction_email: "buyerx@example.com" }], total: 1 });
    expect(db.from).toHaveBeenCalledExactlyOnceWith("checkout_leads");
    expect(chain.range).toHaveBeenCalledWith(0, 49);
  });
  it("does not read buyer emails for a non-manager", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false });
    await expect(read({ data: { page: 0, search: "" }, context: { userId: "viewer", supabase: { rpc } } })).rejects.toThrow("Sem permissão");
    expect(db.from).not.toHaveBeenCalled();
  });
});