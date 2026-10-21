CREATE TABLE public.hosted_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  funnel_id uuid REFERENCES public.funnels(id) ON DELETE SET NULL,
  default_page text NOT NULL DEFAULT 'index.html' CHECK (char_length(default_page) BETWEEN 1 AND 300),
  ab_param text CHECK (ab_param IS NULL OR ab_param ~ '^[A-Za-z0-9_-]{1,60}$'),
  ab_value text CHECK (ab_value IS NULL OR char_length(ab_value) <= 200),
  ab_page text CHECK (ab_page IS NULL OR char_length(ab_page) <= 300),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hosted_sites TO authenticated;
GRANT ALL ON public.hosted_sites TO service_role;
ALTER TABLE public.hosted_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view" ON public.hosted_sites FOR SELECT TO authenticated USING (public.can_view(auth.uid()));
CREATE POLICY "manage" ON public.hosted_sites FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

CREATE TABLE public.hosted_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.hosted_sites(id) ON DELETE CASCADE,
  path text NOT NULL CHECK (char_length(path) BETWEEN 1 AND 300),
  size bigint NOT NULL DEFAULT 0,
  content_type text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hosted_files TO authenticated;
GRANT ALL ON public.hosted_files TO service_role;
ALTER TABLE public.hosted_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view" ON public.hosted_files FOR SELECT TO authenticated USING (public.can_view(auth.uid()));
CREATE POLICY "manage" ON public.hosted_files FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));

CREATE POLICY "sites manage select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'sites' AND public.can_manage(auth.uid()));
CREATE POLICY "sites manage insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sites' AND public.can_manage(auth.uid()));
CREATE POLICY "sites manage update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'sites' AND public.can_manage(auth.uid()));
CREATE POLICY "sites manage delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'sites' AND public.can_manage(auth.uid()));