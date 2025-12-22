-- Add unique constraint for upsert to work properly
ALTER TABLE public.divulgador_poll_results 
ADD CONSTRAINT unique_poll_result UNIQUE (message_id, group_id, option_name);