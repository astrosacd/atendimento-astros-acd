-- Create table for task history
CREATE TABLE public.client_tasks_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.client_tasks(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'status_changed'
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  previous_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_tasks_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage client_tasks_history"
ON public.client_tasks_history
FOR ALL
USING (is_admin());

CREATE POLICY "Operadores can view client_tasks_history"
ON public.client_tasks_history
FOR SELECT
USING (is_operador());

CREATE POLICY "Gerentes can view their task history"
ON public.client_tasks_history
FOR SELECT
USING (is_gerente());

CREATE POLICY "Authenticated can insert task history"
ON public.client_tasks_history
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Index for faster queries
CREATE INDEX idx_client_tasks_history_task_id ON public.client_tasks_history(task_id);
CREATE INDEX idx_client_tasks_history_created_at ON public.client_tasks_history(created_at DESC);