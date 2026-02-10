
CREATE OR REPLACE FUNCTION public.notify_proposal_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_url TEXT;
BEGIN
  -- Only fire when status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Fire for viewed, accepted, rejected (webhooks need viewed too)
  IF NEW.status NOT IN ('viewed', 'accepted', 'rejected') THEN
    RETURN NEW;
  END IF;
  
  v_url := 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/proposal-status-notify';
  
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeGF4ZW1vb3pkZGt3cGl0bmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NjQ1MTQsImV4cCI6MjA4MTA0MDUxNH0.d8F3I7PofiAkTm0qKpu3k1pTGqSFpHPmsl0nMdghvYM'
    ),
    body := jsonb_build_object(
      'proposal_id', NEW.id,
      'new_status', NEW.status,
      'old_status', OLD.status,
      'signed_name', NEW.signed_name,
      'rejection_reason', NEW.rejection_reason
    )
  );
  
  RETURN NEW;
END;
$function$;
