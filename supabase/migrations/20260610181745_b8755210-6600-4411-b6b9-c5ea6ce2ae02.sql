
CREATE TABLE public.mcp_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  caller_api_key_hint TEXT,
  caller_ip TEXT,
  tool_name TEXT,
  tool_type TEXT,
  method TEXT,
  payload JSONB,
  result_summary JSONB,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  duration_ms INTEGER
);

GRANT SELECT ON public.mcp_audit_log TO authenticated;
GRANT ALL ON public.mcp_audit_log TO service_role;

ALTER TABLE public.mcp_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view mcp audit log"
ON public.mcp_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages mcp audit log"
ON public.mcp_audit_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_mcp_audit_log_created_at ON public.mcp_audit_log (created_at DESC);
CREATE INDEX idx_mcp_audit_log_tool_name ON public.mcp_audit_log (tool_name);
