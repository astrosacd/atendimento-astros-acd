-- Step 1: Add new enum values only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operador';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente';