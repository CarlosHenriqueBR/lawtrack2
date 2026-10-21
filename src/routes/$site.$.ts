import { createFileRoute } from "@tanstack/react-router";
import { contentTypeFor, injectTracker, isHtml, pickEntryPage, safePath } from "@/lib/sites";

// Public hosting of uploaded pages: /<slug>/ applies the A/B rule, /<slug>/<file> serves that file.
export const Route = createFileRoute("/$site/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const slug = params.site.toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(slug)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: site } = await db
          .from("hosted_sites")
          .select("id, funnel_id, default_page, ab_param, ab_value, ab_page, enabled")
          .eq("slug", slug)
          .maybeSingle();
        if (!site || !site.enabled) return new Response("Not found", { status: 404 });

        const splat = params._splat ?? "";
        let path: string | null;
        if (!splat) {
          // Trailing slash keeps relative links (style.css, img/x.png) inside the site.
          if (!url.pathname.endsWith("/"))
            return Response.redirect(`${url.origin}/${slug}/${url.search}`, 302);
          path = pickEntryPage(site, url.searchParams);
        } else {
          path = safePath(splat);
          if (path && path.endsWith("/")) path += "index.html";
        }
        if (!path) return new Response("Not found", { status: 404 });

        const { data: blob, error } = await db.storage.from("sites").download(`${site.id}/${path}`);
        if (error || !blob) return new Response("Not found", { status: 404 });

        const type = contentTypeFor(path);
        const headers = new Headers({ "content-type": type, "x-content-type-options": "nosniff" });
        if (isHtml(path)) {
          headers.set("cache-control", "no-cache");
          let html = await blob.text();
          if (site.funnel_id) html = injectTracker(html, url.origin, site.funnel_id);
          return new Response(html, { headers });
        }
        headers.set("cache-control", "public, max-age=300");
        return new Response(blob, { headers });
      },
    },
  },
});
