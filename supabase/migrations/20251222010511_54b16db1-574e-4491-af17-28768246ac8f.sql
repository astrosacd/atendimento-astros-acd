-- Create table to store poll results
CREATE TABLE public.divulgador_poll_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.divulgador_messages(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.divulgador_groups(id) ON DELETE CASCADE,
  poll_name TEXT NOT NULL,
  option_name TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  voters TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.divulgador_poll_results ENABLE ROW LEVEL SECURITY;

-- Create policy for admins
CREATE POLICY "Admins can manage divulgador_poll_results"
  ON public.divulgador_poll_results
  FOR ALL
  USING (is_admin());

-- Create policy for service to insert/update
CREATE POLICY "Service can insert poll results"
  ON public.divulgador_poll_results
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update poll results"
  ON public.divulgador_poll_results
  FOR UPDATE
  USING (true);

-- Create index for faster queries
CREATE INDEX idx_poll_results_message_id ON public.divulgador_poll_results(message_id);
CREATE INDEX idx_poll_results_group_id ON public.divulgador_poll_results(group_id);