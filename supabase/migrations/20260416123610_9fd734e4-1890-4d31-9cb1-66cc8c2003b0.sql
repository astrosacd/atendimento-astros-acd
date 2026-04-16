CREATE TABLE public.pipeline_temporary_links (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    label TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_temporary_links ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own links"
ON public.pipeline_temporary_links
FOR ALL
USING (auth.uid() = created_by);

-- Trigger for updated_at
CREATE TRIGGER update_pipeline_temporary_links_updated_at
BEFORE UPDATE ON public.pipeline_temporary_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to validate token and return pipeline data
CREATE OR REPLACE FUNCTION public.get_pipeline_data_by_token(link_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run as owner to bypass RLS on internal tables for the public link
AS $$
DECLARE
    link_record RECORD;
    result JSONB;
BEGIN
    -- Check if token exists and is not expired
    SELECT * INTO link_record 
    FROM public.pipeline_temporary_links 
    WHERE token = link_token 
    AND (expires_at IS NULL OR expires_at > now());

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Fetch stages and pipeline data
    WITH stages AS (
        SELECT * FROM public.pipeline_stages ORDER BY order_index
    ),
    pipeline AS (
        SELECT 
            cp.*,
            jsonb_build_object(
                'id', c.id,
                'nome', c.nome,
                'produto', c.produto,
                'valor', c.valor,
                'moeda', c.moeda,
                'data_renovacao', c.data_renovacao,
                'email', c.email,
                'numero', c.numero,
                'tags', c.tags
            ) as cliente
        FROM public.client_pipeline cp
        LEFT JOIN public.clientes c ON cp.cliente_id = c.id
    )
    SELECT jsonb_build_object(
        'stages', (SELECT jsonb_agg(stages) FROM stages),
        'clients', (SELECT jsonb_agg(pipeline) FROM pipeline)
    ) INTO result;

    RETURN result;
END;
$$;
