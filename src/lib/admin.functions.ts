import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { maskToken } from "@/lib/integrations";

type Ctx = { supabase: { rpc: (fn: "can_manage" | "user_role_level", args: { _uid: string }) => PromiseLike<{ data: unknown }> }; userId: string };

async function requireManager(context: Ctx) {
  const { data } = await context.supabase.rpc("can_manage", { _uid: context.userId });
  if (data !== true) throw new Error("Sem permissão");
  const { data: level } = await context.supabase.rpc("user_role_level", { _uid: context.userId });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { db: supabaseAdmin, level: Number(level) };
}

async function audit(db: Awaited<ReturnType<typeof requireManager>>["db"], userId: string, action: string, target: string, details: Record<string, string | null> = {}) {
  const { data } = await db.auth.admin.getUserById(userId);
  await db.from("audit_logs").insert({ actor_id: userId, actor_email: data.user?.email ?? null, action, target, details });
}

function randomToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export const getIntegrationSecrets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await requireManager(context);
    const { data } = await db.from("integration_secrets").select("key, value");
    const m = new Map((data ?? []).map((r) => [r.key, r.value]));
    let webhookToken = m.get("digistore_webhook_token");
    if (!webhookToken) {
      webhookToken = randomToken();
      await db.from("integration_secrets").insert({ key: "digistore_webhook_token", value: webhookToken });
    }
    const tt = m.get("tiktok_access_token");
    return {
      webhookToken,
      tiktokTokenHint: tt ? maskToken(tt) : null,
      passphraseSet: !!m.get("digistore_ipn_passphrase"),
    };
  });

export const saveIntegrationSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ key: z.enum(["tiktok_access_token", "digistore_ipn_passphrase", "digistore_webhook_token"]), value: z.string().max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { db } = await requireManager(context);
    const value = data.key === "digistore_webhook_token" ? randomToken() : data.value.trim();
    if (!value) await db.from("integration_secrets").delete().eq("key", data.key);
    else await db.from("integration_secrets").upsert({ key: data.key, value, updated_at: new Date().toISOString() });
    await audit(db, context.userId, data.key === "tiktok_access_token" ? "token alterado" : "integração alterada", data.key);
    return { ok: true };
  });

export const retryQueueItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ ids: z.array(z.string().uuid()).max(100).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { db } = await requireManager(context);
    let q = db.from("event_queue").update({ status: "retry", next_attempt_at: new Date().toISOString(), attempts: 0 });
    q = data.ids?.length ? q.in("id", data.ids) : q.in("status", ["failed", "dead_letter", "retry"]);
    await q;
    const { processQueue } = await import("@/lib/server/ops");
    return processQueue(db, { limit: 100 });
  });

// ---------- Users ----------
const ROLES = ["super_admin", "admin", "analyst", "viewer"] as const;

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, level } = await requireManager(context);
    const { data } = await db.auth.admin.listUsers({ perPage: 200 });
    const { data: roles } = await db.from("user_roles").select("user_id, role");
    return {
      myLevel: level,
      users: (data?.users ?? []).map((u) => ({
        id: u.id,
        email: u.email ?? "",
        confirmed: !!u.email_confirmed_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at,
        blocked: !!u.banned_until && new Date(u.banned_until) > new Date(),
        roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role as string),
      })),
    };
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ email: z.string().email().max(255), role: z.enum(ROLES), redirectTo: z.string().url() }).parse(i))
  .handler(async ({ data, context }) => {
    const { db, level } = await requireManager(context);
    if (data.role === "super_admin" && level < 4) throw new Error("Somente Super Admin pode criar Super Admin");
    const { data: inv, error } = await db.auth.admin.inviteUserByEmail(data.email, { redirectTo: data.redirectTo });
    if (error) throw new Error(error.message);
    await db.from("user_roles").delete().eq("user_id", inv.user.id);
    await db.from("user_roles").insert({ user_id: inv.user.id, role: data.role });
    await audit(db, context.userId, "usuário criado", data.email, { role: data.role });
    return { ok: true };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        action: z.enum(["role", "block", "unblock", "remove", "reset"]),
        role: z.enum(ROLES).optional(),
        redirectTo: z.string().url().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { db, level } = await requireManager(context);
    if (data.userId === context.userId && data.action !== "reset") throw new Error("Você não pode alterar a própria conta aqui");
    const { data: target } = await db.from("user_roles").select("role").eq("user_id", data.userId);
    if ((target ?? []).some((r) => (r.role as string) === "super_admin") && level < 4) throw new Error("Somente Super Admin pode alterar um Super Admin");
    const { data: u } = await db.auth.admin.getUserById(data.userId);
    const email = u.user?.email ?? data.userId;

    if (data.action === "role") {
      if (!data.role) throw new Error("Perfil obrigatório");
      if (data.role === "super_admin" && level < 4) throw new Error("Somente Super Admin pode promover a Super Admin");
      await db.from("user_roles").delete().eq("user_id", data.userId);
      await db.from("user_roles").insert({ user_id: data.userId, role: data.role });
      await audit(db, context.userId, "permissão alterada", email, { role: data.role });
    } else if (data.action === "block" || data.action === "unblock") {
      await db.auth.admin.updateUserById(data.userId, { ban_duration: data.action === "block" ? "876000h" : "none" });
      await audit(db, context.userId, data.action === "block" ? "usuário bloqueado" : "usuário desbloqueado", email);
    } else if (data.action === "remove") {
      await db.auth.admin.deleteUser(data.userId);
      await audit(db, context.userId, "usuário removido", email);
    } else {
      const { error } = await db.auth.resetPasswordForEmail(email, data.redirectTo ? { redirectTo: data.redirectTo } : {});
      if (error) throw new Error(error.message);
      await audit(db, context.userId, "acesso redefinido", email);
    }
    return { ok: true };
  });
