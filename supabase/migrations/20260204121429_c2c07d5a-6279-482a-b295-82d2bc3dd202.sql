-- =====================================================
-- SECURITY FIX: Remove ineffective "Block public access" policies
-- These policies use USING(false) which is ineffective - they don't block anything
-- The tables are properly protected by other authenticated-user policies
-- =====================================================

-- 1. FIX: profiles table - Remove ineffective "Block public access" policy
DROP POLICY IF EXISTS "Block public access to profiles" ON public.profiles;

-- 2. FIX: clientes table - Remove ineffective "Block public access" policy  
DROP POLICY IF EXISTS "Block public access to clientes" ON public.clientes;

-- 3. FIX: consulta_numeros_auto_sync_config - Remove permissive UPDATE/INSERT policies
-- (Admin policies already exist, just need to clean up the old permissive ones)
DROP POLICY IF EXISTS "Authenticated users can update auto sync config" ON public.consulta_numeros_auto_sync_config;
DROP POLICY IF EXISTS "Authenticated users can insert auto sync config" ON public.consulta_numeros_auto_sync_config;