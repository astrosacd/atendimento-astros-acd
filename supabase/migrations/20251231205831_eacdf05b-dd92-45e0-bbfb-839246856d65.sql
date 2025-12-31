-- Drop existing function and recreate with simpler format
DROP FUNCTION IF EXISTS public.generate_task_code() CASCADE;

CREATE OR REPLACE FUNCTION public.generate_task_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence INT;
  v_code TEXT;
BEGIN
  -- Get next sequence number (global, not per year)
  SELECT COALESCE(MAX(CAST(codigo AS INTEGER)), 0) + 1
  INTO v_sequence
  FROM client_tasks
  WHERE codigo ~ '^\d+$';
  
  -- If no valid numeric codes found, start at 1
  IF v_sequence IS NULL THEN
    v_sequence := 1;
  END IF;
  
  -- Generate code like 00001, 00002, etc.
  v_code := LPAD(v_sequence::TEXT, 5, '0');
  
  NEW.codigo := v_code;
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS generate_task_code_trigger ON client_tasks;

CREATE TRIGGER generate_task_code_trigger
BEFORE INSERT ON client_tasks
FOR EACH ROW
EXECUTE FUNCTION public.generate_task_code();