-- Insert new integration status rows if they don't exist
INSERT INTO public.integration_status (integration_name, display_name, category, status)
VALUES 
  ('whatsapp_official', 'WhatsApp Cloud API (Oficial)', 'whatsapp', 'warning'),
  ('instagram_api', 'Instagram Graph API', 'whatsapp', 'warning')
ON CONFLICT (integration_name) DO NOTHING;

-- Copy status from old meta_official if it exists, then delete it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.integration_status WHERE integration_name = 'meta_official') THEN
    UPDATE public.integration_status 
    SET status = (SELECT status FROM public.integration_status WHERE integration_name = 'meta_official'),
        error_message = (SELECT error_message FROM public.integration_status WHERE integration_name = 'meta_official')
    WHERE integration_name IN ('whatsapp_official', 'instagram_api');
    
    DELETE FROM public.integration_status WHERE integration_name = 'meta_official';
  END IF;
END $$;
