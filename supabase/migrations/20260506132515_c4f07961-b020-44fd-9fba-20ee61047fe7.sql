-- Create function to validate token without being a security definer for context, 
-- but we actually need security definer to bypass RLS on the tokens table itself during check.
CREATE OR REPLACE FUNCTION public.check_temp_token_validity(token_val TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.temporary_access_tokens
    WHERE token = token_val
      AND is_active = true
      AND expires_at > now()
      AND (max_uses IS NULL OR uses < max_uses)
  );
END;
$$;

-- Enable public access to instagram tables via GUEST check
-- We use a custom header or session setting. Since we can't easily use headers in pure RLS without complex setup, 
-- we'll rely on a setting or a specific check.
-- However, the most robust way in Supabase is using current_setting('request.headers')::json->>'x-temp-access-token'

ALTER TABLE public.instagram_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public guest can view settings via token"
ON public.instagram_settings
FOR SELECT
USING (
  public.check_temp_token_validity(current_setting('request.headers', true)::json->>'x-temp-access-token')
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public guest can view posts via token"
ON public.posts
FOR SELECT
USING (
  public.check_temp_token_validity(current_setting('request.headers', true)::json->>'x-temp-access-token')
);

CREATE POLICY "Public guest can insert posts via token"
ON public.posts
FOR INSERT
WITH CHECK (
  public.check_temp_token_validity(current_setting('request.headers', true)::json->>'x-temp-access-token')
);

-- Apply similar to logs and history if needed for the UI to function
ALTER TABLE public.post_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public guest can view logs via token"
ON public.post_logs
FOR SELECT
USING (
  public.check_temp_token_validity(current_setting('request.headers', true)::json->>'x-temp-access-token')
);
