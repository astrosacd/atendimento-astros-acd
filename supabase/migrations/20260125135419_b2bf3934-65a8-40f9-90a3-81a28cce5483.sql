-- Fix 1: profiles_table_public_exposure - Block public (anon) access to profiles
CREATE POLICY "Block public access to profiles"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

-- Fix 2: clientes_customer_data_exposure - Block public (anon) access to clientes
CREATE POLICY "Block public access to clientes"
ON public.clientes
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

-- Fix 3: divulgador_instances_no_policies - Add admin-only RLS policies
ALTER TABLE public.divulgador_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view divulgador_instances"
ON public.divulgador_instances
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Only admins can insert divulgador_instances"
ON public.divulgador_instances
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update divulgador_instances"
ON public.divulgador_instances
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete divulgador_instances"
ON public.divulgador_instances
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Fix 4 & 5: Create server-side password verification RPC with bcrypt
-- First, enable the pgcrypto extension if not already enabled (for crypt/gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create function to verify proposal password server-side
CREATE OR REPLACE FUNCTION public.verify_proposal_password(
  p_share_token uuid,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal RECORD;
  v_stored_hash text;
  v_is_valid boolean := false;
  v_result jsonb;
BEGIN
  -- Fetch proposal with password info
  SELECT id, is_password_protected, password_hash, password_channel
  INTO v_proposal
  FROM proposals
  WHERE share_token = p_share_token;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Proposal not found');
  END IF;
  
  -- If not password protected, allow access
  IF NOT v_proposal.is_password_protected OR v_proposal.password_hash IS NULL THEN
    RETURN jsonb_build_object('valid', true, 'password_required', false);
  END IF;
  
  -- Check if password is provided
  IF p_password IS NULL OR p_password = '' THEN
    RETURN jsonb_build_object(
      'valid', false, 
      'password_required', true,
      'password_channel', v_proposal.password_channel
    );
  END IF;
  
  -- Normalize input based on channel
  DECLARE
    v_normalized_input text;
    v_normalized_stored text;
  BEGIN
    -- For email passwords, compare lowercase
    IF v_proposal.password_channel = 'email' THEN
      v_normalized_input := LOWER(TRIM(p_password));
      v_normalized_stored := LOWER(TRIM(v_proposal.password_hash));
    ELSE
      v_normalized_input := TRIM(p_password);
      v_normalized_stored := TRIM(v_proposal.password_hash);
    END IF;
    
    -- Check if stored password is hashed (starts with $2)
    IF v_proposal.password_hash LIKE '$2%' THEN
      -- Verify against bcrypt hash
      v_is_valid := (crypt(v_normalized_input, v_proposal.password_hash) = v_proposal.password_hash);
    ELSE
      -- Legacy plain text comparison (for existing passwords)
      -- New passwords will be hashed by the edge function
      v_is_valid := (v_normalized_input = v_normalized_stored);
    END IF;
  END;
  
  IF v_is_valid THEN
    RETURN jsonb_build_object('valid', true, 'password_required', true);
  ELSE
    RETURN jsonb_build_object('valid', false, 'password_required', true, 'error', 'Incorrect password');
  END IF;
END;
$$;

-- Grant execute permission to anon for public access
GRANT EXECUTE ON FUNCTION public.verify_proposal_password(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_proposal_password(uuid, text) TO authenticated;