import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { catalogRows, checkoutSchema, digistoreId } from "./checkout";

export const getCheckoutCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed } = await context.supabase.rpc("can_manage", { _uid: context.userId });
    if (allowed !== true) throw new Error("Sem permissão");
    const { digistoreCall } = await import("./checkout.server");
    const [products, forms] = await Promise.all([digistoreCall("listProducts"), digistoreCall("listOrderforms", { layout: "widget" })]);
    return { products: catalogRows(products["products"]), orderforms: catalogRows(forms["orderforms"]) };
  });

export const createCheckoutWidget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: z.string().trim().min(1).max(63), steps: z.number().int().min(1).max(3) }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: allowed } = await context.supabase.rpc("can_manage", { _uid: context.userId });
    if (allowed !== true) throw new Error("Sem permissão");
    const { digistoreCall } = await import("./checkout.server");
    const result = await digistoreCall("createOrderform", { "data[name]": data.name, "data[layout]": "widget", "data[step_count]": String(data.steps) });
    const id = digistoreId.parse(String(result["orderform_id"] ?? result["id"] ?? ""));
    await context.supabase.from("audit_logs").insert({ actor_id: context.userId, action: "checkout widget criado", target: id });
    return { id };
  });

export const saveCheckoutLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => checkoutSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: allowed } = await context.supabase.rpc("can_manage", { _uid: context.userId });
    if (allowed !== true) throw new Error("Sem permissão");
    const { digistoreCall } = await import("./checkout.server");
    const [products, forms] = await Promise.all([digistoreCall("listProducts"), digistoreCall("listOrderforms", { layout: "widget" })]);
    if (!catalogRows(products["products"]).some((p) => p.id === data.productId)) throw new Error("O produto não pertence à conta conectada.");
    if (!catalogRows(forms["orderforms"]).some((p) => p.id === data.orderformId)) throw new Error("Selecione um formulário incorporável da conta conectada.");
    const { data: row, error } = await context.supabase.from("checkout_links").insert({ title: data.title, slug: data.slug, product_id: data.productId, orderform_id: data.orderformId, funnel_id: data.funnelId }).select("id, slug").single();
    if (error) throw new Error(error.code === "23505" ? "Este endereço já está em uso. Escolha outro." : "Não foi possível salvar o link.");
    await context.supabase.from("audit_logs").insert({ actor_id: context.userId, action: "checkout link criado", target: row.id });
    return row;
  });