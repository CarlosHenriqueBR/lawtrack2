import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  DollarSign,
  CreditCard,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Mail,
  Plug,
  ScrollText,
  Search,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "./Logo";

// min role level: 1 viewer, 2 analyst, 3 admin, 4 super admin (UI only — RLS and server checks enforce it)
const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, min: 1 },
  { to: "/live", label: "Live Funnel", icon: Activity, min: 2 },
  { to: "/funnels", label: "Funis", icon: BookOpen, min: 2 },
  { to: "/conversions", label: "Conversões", icon: DollarSign, min: 2 },
  { to: "/reports", label: "Relatórios", icon: BarChart3, min: 1 },
  { to: "/search", label: "Pesquisa", icon: Search, min: 2 },
  { to: "/integrations", label: "Integrações", icon: Plug, min: 3 },
  { to: "/ads", label: "Contas TikTok", icon: Megaphone, min: 2 },
  { to: "/checkouts", label: "Checkouts", icon: CreditCard, min: 3 },
  { to: "/leads", label: "Emails salvos", icon: Mail, min: 3 },
  { to: "/logs", label: "Logs", icon: ScrollText, min: 3 },
  { to: "/health", label: "System Health", icon: HeartPulse, min: 3 },
  { to: "/users", label: "Usuários", icon: Users, min: 3 },
] as const;

export const ROLE_LABEL: Record<string, string> = { super_admin: "Super Admin", admin: "Admin", analyst: "Analista", viewer: "Viewer" };

export function useRoleLevel() {
  return useQuery({
    queryKey: ["role-level"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return 0;
      const { data } = await supabase.rpc("user_role_level", { _uid: u.user.id });
      return Number(data ?? 0);
    },
  });
}

export function AppShell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const { data: level = 0, isLoading } = useRoleLevel();

  async function signOut() {
    await supabase.from("audit_logs").insert({ action: "logout", actor_id: (await supabase.auth.getUser()).data.user?.id ?? null });
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const current = nav.find((n) => loc.pathname.startsWith(n.to));
  const pageMin = current?.min ?? (loc.pathname.startsWith("/journey") ? 2 : 1);

  return (
    <div className="flex min-h-screen">
      <button className="fixed left-3 top-3 z-40 rounded-md border bg-card p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
        <Menu className="h-4 w-4" />
      </button>
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-56 shrink-0 flex-col border-r bg-sidebar px-4 py-6 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Logo className="px-2 pl-10 lg:pl-2" />
        <p className="mt-1 px-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{level >= 4 ? "Kira Mode" : "L Mode"}</p>
        <nav className="mt-8 flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {nav
            .filter((n) => level >= n.min)
            .map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                activeProps={{ className: "bg-sidebar-accent text-foreground" }}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            ))}
        </nav>
        <button onClick={signOut} className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-14 sm:px-8 lg:py-8">
        {isLoading ? null : level >= pageMin ? (
          <Outlet />
        ) : (
          <div className="panel mx-auto mt-24 max-w-md p-8 text-center">
            <h1 className="font-display text-3xl">Acesso restrito</h1>
            <p className="mt-2 text-muted-foreground">
              {level === 0 ? "Sua conta ainda não tem um perfil. Peça acesso a um administrador." : "Seu perfil não permite ver esta página."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string | undefined; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl text-foreground">{title}</h1>
        {sub && <p className="mt-1 text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]!);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
}
