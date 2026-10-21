import { z } from "zod";

/** Top-level paths owned by the app; a hosted site can never use them as slug. */
export const RESERVED_SLUGS = new Set([
  "api", "auth", "checkout", "reset-password", "dashboard", "live", "funnels", "conversions",
  "reports", "search", "integrations", "checkouts", "logs", "health", "users", "journey", "pages",
  "assets", "favicon.png", "robots.txt",
]);

export const siteSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{0,59}$/, "Use letras minúsculas, números e hífen.")
  .refine((s) => !RESERVED_SLUGS.has(s), "Este endereço é reservado pela plataforma.");

/** Normalizes a file path inside a site. Returns null for unsafe paths. */
export function safePath(raw: string): string | null {
  let p: string;
  try {
    p = decodeURIComponent(raw);
  } catch {
    return null;
  }
  p = p.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!p || p.length > 300) return null;
  const parts = p.split("/");
  if (parts.some((s) => s === "" || s === "." || s === ".." || /[\u0000-\u001f]/.test(s))) return null;
  return parts.join("/");
}

export type AbRule = {
  default_page: string;
  ab_param: string | null;
  ab_value: string | null;
  ab_page: string | null;
};

/** Page served at the site root: the A/B page when ?param=value matches, otherwise the default. */
export function pickEntryPage(site: AbRule, params: URLSearchParams): string {
  if (site.ab_param && site.ab_page && site.ab_value !== null) {
    if (params.get(site.ab_param) === site.ab_value) return site.ab_page;
  }
  return site.default_page;
}

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  json: "application/json", txt: "text/plain; charset=utf-8", xml: "application/xml",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", avif: "image/avif", ico: "image/x-icon",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
  mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", pdf: "application/pdf",
};

export function contentTypeFor(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? "application/octet-stream";
}

export const isHtml = (path: string) => /\.html?$/i.test(path);

/** Adds the Lawtrack tracker before </head> (or at the top) of an HTML page. */
export function injectTracker(html: string, origin: string, funnelId: string) {
  const tag = `<script src="${origin}/api/public/tracker.js" data-funnel="${funnelId}" defer></script>`;
  const i = html.search(/<\/head>/i);
  return i >= 0 ? html.slice(0, i) + tag + html.slice(i) : tag + html;
}
