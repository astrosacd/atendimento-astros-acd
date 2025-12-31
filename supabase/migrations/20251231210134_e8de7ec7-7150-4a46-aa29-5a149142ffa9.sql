-- Update function to add T prefix
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
  -- Get next sequence number from existing codes with T prefix
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 2) AS INTEGER)), 0) + 1
  INTO v_sequence
  FROM client_tasks
  WHERE codigo ~ '^T\d+$';
  
  -- If no valid codes found, start at 1
  IF v_sequence IS NULL THEN
    v_sequence := 1;
  END IF;
  
  -- Generate code like T00001, T00002, etc.
  v_code := 'T' || LPAD(v_sequence::TEXT, 5, '0');
  
  NEW.codigo := v_code;
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER generate_task_code_trigger
BEFORE INSERT ON client_tasks
FOR EACH ROW
EXECUTE FUNCTION public.generate_task_code();