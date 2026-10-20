import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Funnel = Tables<"funnels">;
export type Step = Tables<"funnel_steps">;
export type Session = Tables<"sessions">;
export type TrackEvent = Tables<"events">;

export async function fetchFunnels() {
  const { data, error } = await supabase
    .from("funnels")
    .select("*, funnel_steps(*)")
    .order("created_at");
  if (error) throw error;
  return data.map((f) => ({ ...f, funnel_steps: [...f.funnel_steps].sort((a, b) => a.step_order - b.step_order) }));
}

export type Period = "today" | "yesterday" | "7d" | "30d";
export function periodRange(p: Period): [Date, Date] {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (p === "today") return [start, now];
  if (p === "yesterday") {
    const y = new Date(start);
    y.setDate(y.getDate() - 1);
    return [y, start];
  }
  const s = new Date(start);
  s.setDate(s.getDate() - (p === "7d" ? 6 : 29));
  return [s, now];
}

/** Invalidates the given query keys whenever sessions/events change (realtime). */
export function useRealtimeInvalidate(keys: string[][]) {
  const qc = useQueryClient();
  const sig = JSON.stringify(keys);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (t) return;
      t = setTimeout(() => {
        t = null;
        (JSON.parse(sig) as string[][]).forEach((k) => qc.invalidateQueries({ queryKey: k }));
      }, 800);
    };
    const ch = supabase
      .channel("lt-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, bump)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, bump)
      .subscribe();
    return () => {
      if (t) clearTimeout(t);
      supabase.removeChannel(ch);
    };
  }, [qc, sig]);
}

export function useNow(ms = 1000) {
  const qc = useQueryClient();
  void qc;
  return ms;
}
