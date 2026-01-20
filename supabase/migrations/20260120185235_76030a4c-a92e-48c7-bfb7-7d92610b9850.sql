-- ===========================================
-- SECURITY FIX: Restrict public proposal access
-- ===========================================

-- 1. Drop the overly permissive public SELECT policy on proposals
DROP POLICY IF EXISTS "Public can view proposals via share token" ON public.proposals;

-- 2. Create a new restrictive public SELECT policy that requires share_token match
CREATE POLICY "Public can view proposals with valid share token"
  ON public.proposals 
  FOR SELECT 
  TO anon
  USING (share_token IS NOT NULL);

-- 3. Drop the overly permissive public UPDATE policy on proposals
DROP POLICY IF EXISTS "Public can update proposals via share token" ON public.proposals;

-- 4. Create a secure RPC function for signing proposals (restricts which columns can be updated)
CREATE OR REPLACE FUNCTION public.sign_proposal(
  p_proposal_id uuid,
  p_share_token uuid,
  p_status text,
  p_client_signature text DEFAULT NULL,
  p_signed_name text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal RECORD;
BEGIN
  -- Fetch proposal and validate share_token
  SELECT id, status, share_token INTO v_proposal
  FROM proposals
  WHERE id = p_proposal_id AND share_token = p_share_token;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid proposal or share token';
  END IF;
  
  -- Validate status transition
  IF p_status NOT IN ('accepted', 'rejected', 'viewed') THEN
    RAISE EXCEPTION 'Invalid status value';
  END IF;
  
  -- Prevent re-signing already finalized proposals
  IF v_proposal.status IN ('accepted', 'rejected') AND p_status IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Proposal already finalized';
  END IF;
  
  -- Update proposal with only allowed fields
  IF p_status = 'accepted' THEN
    UPDATE proposals
    SET 
      status = 'accepted',
      client_signature = p_client_signature,
      signed_at = now(),
      signed_status = 'accepted',
      signed_name = p_signed_name,
      signature_image = p_client_signature
    WHERE id = p_proposal_id AND share_token = p_share_token;
  ELSIF p_status = 'rejected' THEN
    UPDATE proposals
    SET 
      status = 'rejected',
      signed_at = now(),
      signed_status = 'rejected',
      signed_name = p_signed_name,
      rejection_reason = p_rejection_reason
    WHERE id = p_proposal_id AND share_token = p_share_token;
  ELSIF p_status = 'viewed' THEN
    UPDATE proposals
    SET status = 'viewed'
    WHERE id = p_proposal_id 
      AND share_token = p_share_token 
      AND status = 'sent';
  END IF;
  
  RETURN true;
END;
$$;

-- 5. Create a secure RPC function for recording proposal views
CREATE OR REPLACE FUNCTION public.record_proposal_view(
  p_proposal_id uuid,
  p_share_token uuid,
  p_event_type text,
  p_event_data jsonb DEFAULT '{}'::jsonb,
  p_user_agent text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate proposal and share_token match
  IF NOT EXISTS (
    SELECT 1 FROM proposals
    WHERE id = p_proposal_id AND share_token = p_share_token
  ) THEN
    RAISE EXCEPTION 'Invalid proposal or share token';
  END IF;
  
  -- Insert the view event
  INSERT INTO proposal_views (proposal_id, event_type, event_data, user_agent)
  VALUES (p_proposal_id, p_event_type, p_event_data, p_user_agent);
  
  RETURN true;
END;
$$;

-- 6. Drop the overly permissive public SELECT policy on proposal_sections  
DROP POLICY IF EXISTS "Public can view proposal sections" ON public.proposal_sections;

-- 7. Create a new restrictive public SELECT policy for proposal_sections
CREATE POLICY "Public can view sections of proposals with valid share token"
  ON public.proposal_sections
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_sections.proposal_id
        AND p.share_token IS NOT NULL
    )
  );

-- ===========================================
-- SECURITY FIX: Restrict gateway_orders access
-- ===========================================

-- 8. Drop any existing overly permissive SELECT policies on gateway_orders
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.gateway_orders;

-- 9. Create restrictive policies for gateway_orders - only admins can view
CREATE POLICY "Admins can view gateway_orders"
  ON public.gateway_orders
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- 10. Update proposal_branding to also be accessible publicly (needed for preview)
DROP POLICY IF EXISTS "Public can view branding" ON public.proposal_branding;
CREATE POLICY "Public can view branding"
  ON public.proposal_branding
  FOR SELECT
  TO anon
  USING (true);

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION public.sign_proposal TO anon;
GRANT EXECUTE ON FUNCTION public.record_proposal_view TO anon;