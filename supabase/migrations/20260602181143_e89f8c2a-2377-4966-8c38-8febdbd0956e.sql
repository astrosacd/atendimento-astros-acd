CREATE OR REPLACE FUNCTION public.get_public_tables()
RETURNS TABLE (table_name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT tablename::text
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_tables() TO authenticated;
