// Pure tracking helpers shared by the tracking API and the dashboard.

export type SessionStatus = "active" | "inactive" | "left" | "converted";

/** Heartbeat is sent every 15s; a session is "active" if seen in the last 45s. */
export const ACTIVE_WINDOW_MS = 45_000;
/** After 5 minutes without a heartbeat the visitor has left the funnel. */
export const INACTIVE_WINDOW_MS = 5 * 60_000;

export function sessionStatus(lastSeen: string | Date, converted: boolean, now = Date.now()): SessionStatus {
  if (converted) return "converted";
  const age = now - new Date(lastSeen).getTime();
  if (age <= ACTIVE_WINDOW_MS) return "active";
  if (age <= INACTIVE_WINDOW_MS) return "inactive";
  return "left";
}

export interface StepLike {
  id: string;
  url_pattern: string;
  step_order: number;
}

/** Picks the step whose pattern matches the URL; the longest pattern wins. */
export function matchStep<T extends StepLike>(url: string, steps: T[]): T | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const full = (u.host + u.pathname).toLowerCase().replace(/\/+$/, "");
  const path = u.pathname.toLowerCase().replace(/\/+$/, "") || "/";
  let best: T | null = null;
  for (const s of steps) {
    const p = s.url_pattern.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!p) continue;
    const hit = p.startsWith("/") ? path === p || path.startsWith(p + "/") : full.includes(p);
    if (hit && (!best || p.length > best.url_pattern.length)) best = s;
  }
  return best;
}

export function parseUserAgent(ua: string) {
  const s = ua || "";
  const device = /iPad|Tablet/i.test(s) ? "Tablet" : /Mobi|Android|iPhone/i.test(s) ? "Mobile" : "Desktop";
  const os = /Windows/i.test(s)
    ? "Windows"
    : /iPhone|iPad|iOS/i.test(s)
      ? "iOS"
      : /Android/i.test(s)
        ? "Android"
        : /Mac OS X|Macintosh/i.test(s)
          ? "macOS"
          : /Linux/i.test(s)
            ? "Linux"
            : "Other";
  const browser = /Edg\//i.test(s)
    ? "Edge"
    : /OPR\//i.test(s)
      ? "Opera"
      : /SamsungBrowser/i.test(s)
        ? "Samsung"
        : /Chrome\//i.test(s)
          ? "Chrome"
          : /Firefox\//i.test(s)
            ? "Firefox"
            : /Safari\//i.test(s)
              ? "Safari"
              : "Other";
  return { device, os, browser };
}

export function trafficSource(s: { utm_source?: string | null; ttclid?: string | null; referrer?: string | null }) {
  if (s.ttclid || /tiktok/i.test(s.utm_source ?? "")) return "TikTok Ads";
  if (s.utm_source) return s.utm_source;
  if (s.referrer) {
    try {
      return new URL(s.referrer).host.replace(/^www\./, "");
    } catch {
      return "Referência";
    }
  }
  return "Direto";
}

export function flag(country?: string | null) {
  if (!country || country.length !== 2 || country === "XX") return "🏳️";
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

export function shortVisitor(id: string) {
  return "LT-" + id.replace(/[^a-z0-9]/gi, "").slice(-5).toUpperCase();
}

export function fmtDuration(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
