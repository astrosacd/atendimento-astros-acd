-- Update record_proposal_view to increment view_count
CREATE OR REPLACE FUNCTION public.record_proposal_view(
  p_proposal_id UUID,
  p_share_token UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'::jsonb,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS BOOLEAN
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

  -- Increment view_count on 'opened' event
  IF p_event_type = 'opened' THEN
    UPDATE proposals 
    SET view_count = COALESCE(view_count, 0) + 1 
    WHERE id = p_proposal_id;
  END IF;
  
  RETURN true;
END;
$$;
