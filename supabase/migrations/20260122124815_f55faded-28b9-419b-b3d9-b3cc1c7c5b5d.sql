-- =====================================================
-- SECURITY FIX: Restrict public access to proposals data
-- =====================================================

-- 1. FIX PROPOSALS TABLE
-- Remove the overly permissive public SELECT policy that allows viewing ALL proposals
-- The share_token IS NOT NULL condition is always true since all proposals have share_tokens
DROP POLICY IF EXISTS "Public can view proposals with valid share token" ON proposals;

-- Create a secure policy: public can only view proposals if they're accessing via the actual share_token
-- This policy intentionally allows limited access - full access is controlled via the RPC functions sign_proposal() and record_proposal_view()
-- The frontend should NOT directly query proposals table for public viewing - use the RPC instead
CREATE POLICY "Public cannot directly select proposals" ON proposals
  FOR SELECT
  TO anon
  USING (false);

-- 2. FIX PROPOSAL_SECTIONS TABLE  
-- Remove the overly permissive policy
DROP POLICY IF EXISTS "Public can view sections via share token" ON proposal_sections;

-- The existing policy "Public can view sections of proposals with valid share token" is better
-- but it still allows viewing all sections if share_token IS NOT NULL (which is always true)
DROP POLICY IF EXISTS "Public can view sections of proposals with valid share token" ON proposal_sections;

-- Create secure policy: block direct public access - use RPC or authenticated queries only
CREATE POLICY "Public cannot directly select proposal_sections" ON proposal_sections
  FOR SELECT
  TO anon
  USING (false);

-- 3. FIX PROPOSAL_BRANDING TABLE
-- The branding table should only be accessible to authenticated users or via proposal context
DROP POLICY IF EXISTS "Public can view branding" ON proposal_branding;

-- Block direct public access
CREATE POLICY "Public cannot directly select proposal_branding" ON proposal_branding
  FOR SELECT
  TO anon
  USING (false);

-- 4. FIX GATEWAY_ORDERS TABLE
-- The Service policies should be scoped to service_role only, not public
DROP POLICY IF EXISTS "Service can insert orders" ON gateway_orders;
DROP POLICY IF EXISTS "Service can update orders" ON gateway_orders;

-- Recreate with proper service_role scoping
CREATE POLICY "Service role can insert orders" ON gateway_orders
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update orders" ON gateway_orders
  FOR UPDATE
  TO service_role
  USING (true);

-- 5. CREATE SECURE RPC FOR PUBLIC PROPOSAL VIEWING
-- This function allows public users to view a proposal if they have the correct share_token
CREATE OR REPLACE FUNCTION public.get_proposal_by_share_token(p_share_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal jsonb;
  v_sections jsonb;
  v_branding jsonb;
BEGIN
  -- Get proposal data
  SELECT jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'status', p.status,
    'total_value', p.total_value,
    'currency', p.currency,
    'valid_until', p.valid_until,
    'expires_at', p.expires_at,
    'is_password_protected', p.is_password_protected,
    'manual_client_name', p.manual_client_name,
    'manual_client_email', p.manual_client_email,
    'signed_at', p.signed_at,
    'signed_status', p.signed_status,
    'signed_name', p.signed_name,
    'signature_image', p.signature_image,
    'rejection_reason', p.rejection_reason,
    'created_at', p.created_at
  )
  INTO v_proposal
  FROM proposals p
  WHERE p.share_token = p_share_token;
  
  IF v_proposal IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get sections for this proposal
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'proposal_id', s.proposal_id,
      'section_type', s.section_type,
      'title', s.title,
      'content', s.content,
      'order_index', s.order_index,
      'is_visible', s.is_visible
    ) ORDER BY s.order_index
  ), '[]'::jsonb)
  INTO v_sections
  FROM proposal_sections s
  WHERE s.proposal_id = (v_proposal->>'id')::uuid
    AND s.is_visible = true;
  
  -- Get branding
  SELECT jsonb_build_object(
    'id', b.id,
    'company_name', b.company_name,
    'tagline', b.tagline,
    'logo_url', b.logo_url,
    'primary_color', b.primary_color,
    'secondary_color', b.secondary_color,
    'accent_color', b.accent_color,
    'font_family', b.font_family,
    'cover_background_url', b.cover_background_url,
    'show_logo_on_cover', b.show_logo_on_cover,
    'show_logo_on_pages', b.show_logo_on_pages,
    'footer_contact', b.footer_contact,
    'footer_website', b.footer_website,
    'footer_social', b.footer_social,
    'client_logos', b.client_logos,
    'certifications', b.certifications
  )
  INTO v_branding
  FROM proposal_branding b
  LIMIT 1;
  
  -- Return combined data
  RETURN jsonb_build_object(
    'proposal', v_proposal,
    'sections', v_sections,
    'branding', v_branding
  );
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.get_proposal_by_share_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_proposal_by_share_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_proposal_by_share_token(uuid) TO service_role;