CREATE TABLE public.checkout_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
 product_id text NOT NULL CHECK (product_id ~ '^[0-9]{1,20}$'),
 orderform_id text NOT NULL CHECK (orderform_id ~ '^[0-9]{1,20}$'),
 funnel_id uuid REFERENCES public.funnels(id) ON DELETE SET NULL,
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.checkout_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkout_links TO authenticated;
GRANT ALL ON public.checkout_links TO service_role;
ALTER TABLE public.checkout_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public enabled checkout links" ON public.checkout_links FOR SELECT TO anon, authenticated USING (enabled);
CREATE POLICY "Managers maintain checkout links" ON public.checkout_links FOR ALL TO authenticated USING (public.can_manage(auth.uid())) WITH CHECK (public.can_manage(auth.uid()));