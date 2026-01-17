-- Unificar categoria de permissões de propostas (corrigir case)
UPDATE system_permissions 
SET category = 'Propostas' 
WHERE category = 'propostas';