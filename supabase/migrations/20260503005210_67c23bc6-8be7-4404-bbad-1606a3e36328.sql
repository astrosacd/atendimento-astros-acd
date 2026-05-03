-- Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company_assets', 'company_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public to view assets
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'company_assets');

-- Policy to allow authenticated users to upload
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company_assets' AND auth.role() = 'authenticated');

-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policies for system_settings
CREATE POLICY "Anyone can view settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Only auth can update settings" ON public.system_settings FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Only auth can insert settings" ON public.system_settings FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Insert default logo placeholder if not exists
INSERT INTO public.system_settings (key, value) 
VALUES ('company_logo', null)
ON CONFLICT (key) DO NOTHING;