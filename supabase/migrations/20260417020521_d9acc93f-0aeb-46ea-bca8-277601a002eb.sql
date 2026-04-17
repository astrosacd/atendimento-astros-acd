
-- Tabela para armazenar previsões de vendas geradas pela IA
CREATE TABLE IF NOT EXISTS public.sales_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  predicted_revenue_brl NUMERIC(14,2) NOT NULL DEFAULT 0,
  predicted_revenue_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  confidence_pct INTEGER NOT NULL DEFAULT 0 CHECK (confidence_pct >= 0 AND confidence_pct <= 100),
  pipeline_value_brl NUMERIC(14,2) NOT NULL DEFAULT 0,
  pipeline_value_usd NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_leads INTEGER NOT NULL DEFAULT 0,
  hot_leads INTEGER NOT NULL DEFAULT 0,
  warm_leads INTEGER NOT NULL DEFAULT 0,
  cold_leads INTEGER NOT NULL DEFAULT 0,
  reasoning TEXT,
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  risks JSONB DEFAULT '[]'::jsonb,
  opportunities JSONB DEFAULT '[]'::jsonb,
  raw_analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_forecasts_generated_at 
  ON public.sales_forecasts (generated_at DESC);

ALTER TABLE public.sales_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales forecasts"
  ON public.sales_forecasts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create sales forecasts"
  ON public.sales_forecasts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = generated_by);

CREATE POLICY "Admins can delete sales forecasts"
  ON public.sales_forecasts FOR DELETE
  TO authenticated
  USING (public.is_admin());
