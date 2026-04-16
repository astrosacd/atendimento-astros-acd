-- Adiciona coluna chatwoot_conversation_id na tabela client_pipeline
ALTER TABLE public.client_pipeline 
ADD COLUMN chatwoot_conversation_id INTEGER;

-- Cria um índice para buscas rápidas
CREATE INDEX idx_client_pipeline_chatwoot_id ON public.client_pipeline(chatwoot_conversation_id);