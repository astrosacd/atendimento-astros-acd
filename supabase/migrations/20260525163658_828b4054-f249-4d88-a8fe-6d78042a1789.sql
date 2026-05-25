
CREATE TABLE IF NOT EXISTS public.instagram_oauth_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.social_media_client_profiles(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','expired','mismatch','revoked')),
  used_at timestamptz,
  used_by_fb_user_id text,
  used_by_ig_username text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ig_invites_profile ON public.instagram_oauth_invites(profile_id);
CREATE INDEX IF NOT EXISTS idx_ig_invites_token ON public.instagram_oauth_invites(token);

ALTER TABLE public.instagram_oauth_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invites"
ON public.instagram_oauth_invites
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.validate_instagram_invite_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_profile RECORD;
BEGIN
  SELECT * INTO v_invite
  FROM public.instagram_oauth_invites
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'not_found');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'expired');
  END IF;

  IF v_invite.status = 'completed' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'already_used', 'used_at', v_invite.used_at);
  END IF;

  SELECT id, username, display_name, profile_picture_url
  INTO v_profile
  FROM public.social_media_client_profiles
  WHERE id = v_invite.profile_id;

  RETURN jsonb_build_object(
    'valid', true,
    'invite_id', v_invite.id,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'username', v_profile.username,
      'display_name', v_profile.display_name,
      'profile_picture_url', v_profile.profile_picture_url
    ),
    'expires_at', v_invite.expires_at,
    'message', v_invite.message
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_instagram_invite_token(uuid) TO anon, authenticated;
