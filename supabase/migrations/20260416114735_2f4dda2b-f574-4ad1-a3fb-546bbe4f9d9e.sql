-- Add analysis_id column to reports_notification_logs
ALTER TABLE public.reports_notification_logs 
ADD COLUMN analysis_id UUID REFERENCES public.reports_analysis_history(id) ON DELETE CASCADE;

-- Create an index for better performance
CREATE INDEX idx_reports_notification_logs_analysis_id ON public.reports_notification_logs(analysis_id);
