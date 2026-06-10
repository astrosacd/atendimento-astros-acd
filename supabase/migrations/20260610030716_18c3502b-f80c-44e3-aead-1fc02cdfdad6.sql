CREATE TABLE IF NOT EXISTS public.mcp_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mcp_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    tool_type TEXT NOT NULL, -- 'sql_query', 'edge_function', 'table_access'
    configuration JSONB, -- stores table name, function name, or SQL template
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.mcp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_tools ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON public.mcp_config TO authenticated;
GRANT ALL ON public.mcp_config TO service_role;
GRANT ALL ON public.mcp_tools TO authenticated;
GRANT ALL ON public.mcp_tools TO service_role;

-- Políticas de acesso (Admin)
CREATE POLICY "Allow all access to authenticated users for mcp_config" ON public.mcp_config FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access to authenticated users for mcp_tools" ON public.mcp_tools FOR ALL USING (auth.role() = 'authenticated');

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_mcp_config_updated_at BEFORE UPDATE ON public.mcp_config FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_mcp_tools_updated_at BEFORE UPDATE ON public.mcp_tools FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Inserir chave padrão inicial (UUID aleatório como API Key)
INSERT INTO public.mcp_config (config_key, config_value, description)
VALUES ('mcp_api_key', encode(gen_random_bytes(32), 'hex'), 'Chave de API para o OpenClaw acessar o servidor MCP');

-- Inserir algumas ferramentas de exemplo baseadas nas tabelas existentes
INSERT INTO public.mcp_tools (name, description, enabled, tool_type, configuration)
VALUES 
('list_clients', 'Lista clientes cadastrados no sistema', true, 'table_access', '{"table": "clientes", "operations": ["select"]}'),
('query_billing', 'Consulta logs de faturamento', true, 'table_access', '{"table": "billing_logs", "operations": ["select"]}'),
('manage_users', 'Gerencia perfis de usuários', false, 'table_access', '{"table": "profiles", "operations": ["select", "update"]}');
