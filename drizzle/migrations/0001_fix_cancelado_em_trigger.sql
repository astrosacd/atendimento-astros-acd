CREATE OR REPLACE FUNCTION public.handle_cliente_cancelado_em()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  had_tag boolean := COALESCE('cancelado' = ANY(OLD.tags), false);
  has_tag boolean := COALESCE('cancelado' = ANY(NEW.tags), false);
BEGIN
  IF has_tag AND NOT had_tag THEN
    NEW.cancelado_em := COALESCE(NEW.cancelado_em, now());
  ELSIF NOT has_tag AND had_tag THEN
    NEW.cancelado_em := NULL;
  END IF;
  RETURN NEW;
END;
$function$;