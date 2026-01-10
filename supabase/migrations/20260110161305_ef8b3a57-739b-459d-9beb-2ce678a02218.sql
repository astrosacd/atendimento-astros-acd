-- Create cache table for Baserow numbers
CREATE TABLE public.consulta_numeros_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  baserow_row_id INTEGER NOT NULL UNIQUE,
  row_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_consulta_numeros_cache_baserow_row_id ON public.consulta_numeros_cache (baserow_row_id);
CREATE INDEX idx_consulta_numeros_cache_row_data ON public.consulta_numeros_cache USING GIN (row_data);

-- Enable RLS
ALTER TABLE public.consulta_numeros_cache ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read (admins/users with permission)
CREATE POLICY "Authenticated users can read consulta_numeros_cache"
ON public.consulta_numeros_cache
FOR SELECT
TO authenticated
USING (true);

-- Only service role can insert/update (sync happens via edge function)
CREATE POLICY "Service role can manage consulta_numeros_cache"
ON public.consulta_numeros_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create cache fields table (to store Baserow field definitions)
CREATE TABLE public.consulta_numeros_fields_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fields_data JSONB NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.consulta_numeros_fields_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fields cache"
ON public.consulta_numeros_fields_cache
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage fields cache"
ON public.consulta_numeros_fields_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Sync status table to track last sync
CREATE TABLE public.consulta_numeros_sync_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_status TEXT,
  rows_synced INTEGER DEFAULT 0,
  error_message TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.consulta_numeros_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sync status"
ON public.consulta_numeros_sync_status
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage sync status"
ON public.consulta_numeros_sync_status
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Insert initial sync status row
INSERT INTO public.consulta_numeros_sync_status (last_sync_status) VALUES ('pending');

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_consulta_numeros_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_consulta_numeros_cache_updated_at
BEFORE UPDATE ON public.consulta_numeros_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_consulta_numeros_cache_updated_at();