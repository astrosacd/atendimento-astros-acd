-- Add unique code column to client_tasks
ALTER TABLE public.client_tasks
ADD COLUMN codigo TEXT UNIQUE;

-- Create function to generate unique task code
CREATE OR REPLACE FUNCTION public.generate_task_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_sequence INT;
  v_code TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YY');
  
  -- Get next sequence number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 4) AS INTEGER)), 0) + 1
  INTO v_sequence
  FROM client_tasks
  WHERE codigo LIKE 'T' || v_year || '%';
  
  -- Generate code like T25001, T25002, etc.
  v_code := 'T' || v_year || LPAD(v_sequence::TEXT, 3, '0');
  
  NEW.codigo := v_code;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate code
CREATE TRIGGER generate_task_code_trigger
BEFORE INSERT ON public.client_tasks
FOR EACH ROW
WHEN (NEW.codigo IS NULL)
EXECUTE FUNCTION public.generate_task_code();

-- Update existing tasks with codes
DO $$
DECLARE
  task_record RECORD;
  v_year TEXT;
  v_sequence INT := 0;
BEGIN
  v_year := TO_CHAR(NOW(), 'YY');
  
  FOR task_record IN 
    SELECT id FROM client_tasks WHERE codigo IS NULL ORDER BY created_at
  LOOP
    v_sequence := v_sequence + 1;
    UPDATE client_tasks 
    SET codigo = 'T' || v_year || LPAD(v_sequence::TEXT, 3, '0')
    WHERE id = task_record.id;
  END LOOP;
END $$;

-- Add deletion_reason column to history table
ALTER TABLE public.client_tasks_history
ADD COLUMN deletion_reason TEXT;