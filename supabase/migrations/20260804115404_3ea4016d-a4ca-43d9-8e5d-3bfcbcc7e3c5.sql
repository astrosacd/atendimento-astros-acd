CREATE TABLE public.system_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  login_logo_url text,
  favicon_url text,
  og_image_url text,
  sidebar_logo_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.system_branding TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_branding TO authenticated;
GRANT ALL ON public.system_branding TO service_role;

ALTER TABLE public.system_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branding is publicly readable"
ON public.system_branding FOR SELECT
USING (true);

CREATE POLICY "Admins can insert branding"
ON public.system_branding FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update branding"
ON public.system_branding FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete branding"
ON public.system_branding FOR DELETE TO authenticated
USING (public.is_admin());

INSERT INTO public.system_branding (singleton) VALUES (true);