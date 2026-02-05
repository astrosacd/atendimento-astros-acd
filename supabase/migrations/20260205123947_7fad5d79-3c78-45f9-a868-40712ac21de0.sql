-- Add remarketing message templates to proposal_send_config
ALTER TABLE public.proposal_send_config 
ADD COLUMN IF NOT EXISTS email_remarketing_subject_template text DEFAULT 'Sua proposta está esperando: {{proposalTitle}}',
ADD COLUMN IF NOT EXISTS email_remarketing_body_template text DEFAULT 'Percebi que você visualizou a proposta, mas ainda não deu seu retorno. Posso ajudar com alguma dúvida?',
ADD COLUMN IF NOT EXISTS whatsapp_remarketing_template text DEFAULT '👋 Olá {{clientName}}, percebi que você visualizou a proposta "{{proposalTitle}}" mas ainda não assinou. Posso ajudar com alguma dúvida?';