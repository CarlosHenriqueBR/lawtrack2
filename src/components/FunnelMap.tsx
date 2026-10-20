import type { Session, Step } from "@/lib/data";

export function FunnelMap({ steps, sessions }: { steps: Step[]; sessions: Session[] }) {
  const counts = steps.map((s) => sessions.filter((x) => x.max_step_order >= s.step_order).length);
  const top = counts[0] || 1;
  return (
    <div className="space-y-1">
      {steps.map((s, i) => {
        const c = counts[i];
        const next = counts[i + 1];
        const pct = (c / top) * 100;
        return (
          <div key={s.id}>
            <div className="flex items-center gap-4">
              <div className="w-44 shrink-0 text-xs uppercase tracking-widest text-muted-foreground">{s.name}</div>
              <div className="relative h-9 flex-1 overflow-hidden rounded-sm bg-muted">
                <div className="absolute inset-y-0 left-0 bg-primary/80 transition-all" style={{ width: `${pct}%` }} />
                <span className="absolute inset-y-0 left-3 flex items-center font-medium text-foreground">
                  {c.toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="w-14 text-right text-muted-foreground">{pct.toFixed(0)}%</div>
            </div>
            {next !== undefined && (
              <div className="ml-48 py-1 text-[11px] text-muted-foreground">
                ↓ {c ? ((next / c) * 100).toFixed(0) : 0}% avançam · {c - next} abandonos
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
