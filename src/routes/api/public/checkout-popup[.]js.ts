import { createFileRoute } from "@tanstack/react-router";
import { checkoutPopupScript } from "@/lib/checkout-embed";

export const Route = createFileRoute("/api/public/checkout-popup.js")({
  server: { handlers: {
    GET: () => new Response(checkoutPopupScript, { headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    } }),
  } },
});