import { z } from "zod";

export const embedSlug = z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/);
export const embedLeadKey = z.string().regex(/^L[a-f0-9]{32}$/);
export const embedCaptureSchema = z.object({
  slug: embedSlug,
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  sessionKey: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).nullable().default(null),
  utms: z.object({
    utm_source: z.string().max(200).nullable(),
    utm_medium: z.string().max(200).nullable(),
    utm_campaign: z.string().max(200).nullable(),
    utm_content: z.string().max(200).nullable(),
    utm_term: z.string().max(200).nullable(),
  }).strict(),
}).strict();

export function embeddedPaymentPath(slug: string, key: string) {
  return `/checkout/${embedSlug.parse(slug)}#lead=${embedLeadKey.parse(key)}`;
}

export function embedSnippet(origin: string, slug: string) {
  embedSlug.parse(slug);
  const base = new URL(origin).origin;
  return `<script src="${base}/api/public/lead-popup.js" data-checkout="${slug}" defer></script>\n<button type="button" onclick="openPopup()">Comprar agora</button>`;
}