import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const apiKey = req.headers.get('x-api-key');
  
  // Verify if MCP is enabled and check API Key
  const { data: configs, error: configError } = await supabase
    .from('mcp_config')
    .select('config_key, config_value')
    .in('config_key', ['mcp_api_key', 'mcp_enabled']);

  if (configError || !configs) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const mcpEnabled = configs.find(c => c.config_key === 'mcp_enabled')?.config_value === 'true';
  const validApiKey = configs.find(c => c.config_key === 'mcp_api_key')?.config_value;

  if (!mcpEnabled) {
    return new Response(JSON.stringify({ error: 'MCP Server is disabled' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (apiKey !== validApiKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { method, params, id } = body;

    // MCP Methods
    if (method === 'notifications/initialized') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: {} }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    if (method === 'tools/list') {
      const { data: tools, error: toolsError } = await supabase
        .from('mcp_tools')
        .select('*')
        .eq('enabled', true);

      if (toolsError) throw toolsError;

      const mcpTools = tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: {
          type: 'object',
          properties: t.configuration?.inputSchema?.properties || {},
          required: t.configuration?.inputSchema?.required || [],
        }
      }));

      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: { tools: mcpTools }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      
      const { data: tool, error: toolError } = await supabase
        .from('mcp_tools')
        .select('*')
        .eq('name', name)
        .eq('enabled', true)
        .single();

      if (toolError || !tool) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Tool not found or disabled' }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let result;
      if (tool.tool_type === 'table_access') {
        const { table, operations } = tool.configuration;
        // Basic implementation for select only for now
        if (operations.includes('select')) {
           const { data, error } = await supabase.from(table).select('*').limit(50);
           if (error) throw error;
           result = data;
        } else {
            throw new Error('Operation not supported for this tool');
        }
      } else if (tool.tool_type === 'sql_query') {
          // Dangerous, only if the user explicitly enables a SQL tool
          const { query } = args;
          const { data, error } = await supabase.rpc('execute_sql', { sql_query: query });
          if (error) throw error;
          result = data;
      }

      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: 'Method not found' }
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: body?.id,
      error: { code: -32603, message: error.message }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
