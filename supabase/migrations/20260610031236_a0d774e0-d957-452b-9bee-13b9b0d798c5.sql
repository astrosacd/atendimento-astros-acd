CREATE OR REPLACE FUNCTION public.get_public_tables()
RETURNS TABLE (table_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT t.table_name::TEXT
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tables() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_tables() TO service_role;
