import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, ROLE_LABEL } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteUser, listUsers, updateUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Usuários — Lawtrack" }, { name: "description", content: "Usuários e perfis." }] }),
  component: UsersPage,
});

const ROLES = ["super_admin", "admin", "analyst", "viewer"] as const;
type Role = (typeof ROLES)[number];

function UsersPage() {
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const invite = useServerFn(inviteUser);
  const update = useServerFn(updateUser);
  const q = useQuery({ queryKey: ["users"], queryFn: () => list() });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");

  async function run(p: Promise<unknown>, ok: string) {
    try {
      await p;
      toast.success(ok);
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const redirectTo = typeof window !== "undefined" ? window.location.origin + "/reset-password" : "";
  const sel = "rounded-md border bg-card px-3 py-1.5";
  const roles = ROLES.filter((r) => r !== "super_admin" || (q.data?.myLevel ?? 0) >= 4);

  return (
    <div>
      <PageHeader title="Usuários" sub="Convide pessoas e defina o que cada uma pode ver.">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(invite({ data: { email, role, redirectTo } }), "Convite enviado").then(() => setEmail(""));
          }}
        >
          <Input type="email" required placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-64" />
          <select className={sel} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <Button type="submit">Convidar</Button>
        </form>
      </PageHeader>
      <div className="panel overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>
              {["Email", "Perfil", "Status", "Último acesso", ""].map((h) => (
                <th key={h} className="px-4 py-3 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.data?.users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    className={sel}
                    value={u.roles[0] ?? ""}
                    onChange={(e) => run(update({ data: { userId: u.id, action: "role", role: e.target.value as Role } }), "Perfil alterado")}
                  >
                    <option value="" disabled>
                      Sem perfil
                    </option>
                    {ROLES.map((r) => (
                      <option key={r} value={r} disabled={r === "super_admin" && (q.data?.myLevel ?? 0) < 4}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {u.blocked ? <span className="text-destructive">Bloqueado</span> : u.confirmed ? <span className="text-success">Ativo</span> : <span className="text-warning">Convite pendente</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR") : "—"}</td>
                <td className="space-x-1 px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => run(update({ data: { userId: u.id, action: "reset", redirectTo } }), "Email de redefinição enviado")}>
                    Redefinir acesso
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run(update({ data: { userId: u.id, action: u.blocked ? "unblock" : "block" } }), u.blocked ? "Desbloqueado" : "Bloqueado")}
                  >
                    {u.blocked ? "Desbloquear" : "Bloquear"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => confirm(`Remover ${u.email}?`) && run(update({ data: { userId: u.id, action: "remove" } }), "Removido")}
                  >
                    Remover
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 grid gap-3 text-xs text-muted-foreground md:grid-cols-4">
        <p><b className="text-foreground">Super Admin</b> — tudo.</p>
        <p><b className="text-foreground">Admin</b> — tudo, exceto gerenciar Super Admins.</p>
        <p><b className="text-foreground">Analista</b> — dashboard, funis, visitantes, conversões, relatórios.</p>
        <p><b className="text-foreground">Viewer</b> — dashboard e relatórios.</p>
      </div>
    </div>
  );
}
