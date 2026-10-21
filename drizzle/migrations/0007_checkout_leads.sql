CREATE TABLE public.checkout_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  transaction_email text NOT NULL UNIQUE CHECK (char_length(transaction_email) BETWEEN 3 AND 254),
  lead_key text NOT NULL UNIQUE CHECK (lead_key ~ '^L[a-f0-9]{32}$'),
  session_key text CHECK (session_key IS NULL OR session_key ~ '^[A-Za-z0-9_-]{1,80}$'),
  utm_source text CHECK (utm_source IS NULL OR char_length(utm_source) <= 200),
  utm_medium text CHECK (utm_medium IS NULL OR char_length(utm_medium) <= 200),
  utm_campaign text CHECK (utm_campaign IS NULL OR char_length(utm_campaign) <= 200),
  utm_content text CHECK (utm_content IS NULL OR char_length(utm_content) <= 200),
  utm_term text CHECK (utm_term IS NULL OR char_length(utm_term) <= 200),
  access_email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX checkout_leads_email_created_at_idx ON public.checkout_leads(email, created_at DESC);
CREATE INDEX checkout_leads_session_key_idx ON public.checkout_leads(session_key);
ALTER TABLE public.checkout_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_leads FROM anon, authenticated;
GRANT ALL ON public.checkout_leads TO service_role;
