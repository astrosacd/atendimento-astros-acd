CREATE TRIGGER on_proposal_status_change
  AFTER UPDATE OF status ON public.proposals
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_proposal_status_change();