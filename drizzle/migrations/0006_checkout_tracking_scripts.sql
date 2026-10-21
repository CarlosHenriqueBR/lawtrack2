ALTER TABLE public.checkout_links
  ADD COLUMN tiktok_pixel_id text CHECK (tiktok_pixel_id IS NULL OR tiktok_pixel_id ~ '^[A-Z0-9]{8,40}$'),
  ADD COLUMN custom_script text CHECK (custom_script IS NULL OR char_length(custom_script) <= 20000);