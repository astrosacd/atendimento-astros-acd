ALTER TABLE public.client_followups
  ADD COLUMN IF NOT EXISTS envio_tipo text NOT NULL DEFAULT 'proposta',
  ADD COLUMN IF NOT EXISTS doc_link text,
  ADD COLUMN IF NOT EXISTS doc_pdf_url text,
  ADD COLUMN IF NOT EXISTS doc_pdf_name text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_followups_envio_tipo_check'
  ) THEN
    ALTER TABLE public.client_followups
      ADD CONSTRAINT client_followups_envio_tipo_check
      CHECK (envio_tipo IN ('proposta','contrato','distrato'));
  END IF;
END $$;

CREATE POLICY "Authenticated can read contratos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contratos');

CREATE POLICY "Authenticated can upload contratos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contratos');

CREATE POLICY "Authenticated can update contratos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'contratos');

CREATE POLICY "Authenticated can delete contratos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contratos');