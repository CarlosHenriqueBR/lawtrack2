-- Grant admin to the existing account
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE lower(email) = 'digitalprodutosbrasiloficial@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Keep the signup trigger allow-list in sync so this email is admin on any future signup too
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) IN (
    'isaacbcb2025@gmail.com',
    'carlos-henrique720@hotmail.com',
    'digitalprodutosbrasiloficial@gmail.com'
  ) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role IN ('admin', 'super_admin')) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;