import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

async function logAudit(
  supabase: SupabaseClient,
  data: {
    action: string;
    resource_type: string;
    resource_id?: string;
    api_key_id?: string;
    webhook_id?: string;
    request_method: string;
    request_path: string;
    request_body?: unknown;
    response_status: number;
    response_body?: unknown;
    ip_address?: string;
    user_agent?: string;
  }
) {
  try {
    await supabase.from('audit_logs').insert({
      action: data.action,
      resource_type: data.resource_type,
      resource_id: data.resource_id || null,
      api_key_id: data.api_key_id || null,
      webhook_id: data.webhook_id || null,
      request_method: data.request_method,
      request_path: data.request_path,
      request_body: data.request_body || null,
      response_status: data.response_status,
      response_body: data.response_body || null,
      ip_address: data.ip_address || null,
      user_agent: data.user_agent || null,
    });
  } catch (err) {
    console.error('Failed to log audit:', err);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    // Verificar API Key do header
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey) {
      console.log('API request without API key');
      await logAudit(supabase, {
        action: 'auth_failed',
        resource_type: 'api',
        request_method: req.method,
        request_path: url.pathname,
        response_status: 401,
        response_body: { error: 'API key é obrigatória' },
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      return new Response(
        JSON.stringify({ error: 'API key é obrigatória. Use o header x-api-key' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verificar se a API key existe e está ativa na tabela api_keys OU webhooks
    const { data: apiKeyRecord } = await supabase
      .from('api_keys')
      .select('*')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();

    const { data: webhook } = await supabase
      .from('webhooks')
      .select('*')
      .eq('secret_key', apiKey)
      .eq('is_active', true)
      .single();

    if (!apiKeyRecord && !webhook) {
      console.log('Invalid API key attempt:', apiKey);
      await logAudit(supabase, {
        action: 'auth_failed',
        resource_type: 'api',
        request_method: req.method,
        request_path: url.pathname,
        response_status: 401,
        response_body: { error: 'API key inválida' },
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      return new Response(
        JSON.stringify({ error: 'API key inválida ou inativa' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Atualizar last_used_at se for api_key da tabela api_keys
    if (apiKeyRecord) {
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', apiKeyRecord.id);
    }

    console.log('API request authenticated:', apiKeyRecord ? `API Key: ${apiKeyRecord.name}` : `Webhook: ${webhook?.name}`);

    // GET /api-clientes - Listar clientes
    if (req.method === 'GET') {
      const searchQuery = url.searchParams.get('search');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('clientes')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.or(`nome.ilike.%${searchQuery}%,cpf.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,numero.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching clientes:', error);
        await logAudit(supabase, {
          action: 'list_error',
          resource_type: 'clientes',
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          response_status: 500,
          response_body: { error: error.message },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`Listed ${data?.length} clientes`);
      await logAudit(supabase, {
        action: 'list',
        resource_type: 'clientes',
        api_key_id: apiKeyRecord?.id,
        webhook_id: webhook?.id,
        request_method: req.method,
        request_path: url.pathname,
        response_status: 200,
        response_body: { count: data?.length },
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      return new Response(
        JSON.stringify({ 
          data, 
          pagination: { 
            total: count, 
            limit, 
            offset,
            hasMore: count ? offset + limit < count : false
          } 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // POST /api-clientes - Criar cliente
    if (req.method === 'POST') {
      const body = await req.json();
      
      const { nome, numero, produto, data_renovacao, email, cpf, plano, valor, observacao } = body;

      if (!nome || !numero || !produto || !data_renovacao || !email || !cpf || valor === undefined) {
        await logAudit(supabase, {
          action: 'create_error',
          resource_type: 'clientes',
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          request_body: body,
          response_status: 400,
          response_body: { error: 'Campos obrigatórios faltando' },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(
          JSON.stringify({ 
            error: 'Campos obrigatórios: nome, numero, produto, data_renovacao, email, cpf, valor' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const { data, error } = await supabase
        .from('clientes')
        .insert({
          nome,
          numero,
          produto,
          data_renovacao,
          email,
          cpf,
          plano: plano || null,
          valor: Number(valor),
          observacao: observacao || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating cliente:', error);
        await logAudit(supabase, {
          action: 'create_error',
          resource_type: 'clientes',
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          request_body: body,
          response_status: 500,
          response_body: { error: error.message },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('Cliente created via API:', data.id);
      await logAudit(supabase, {
        action: 'create',
        resource_type: 'clientes',
        resource_id: data.id,
        api_key_id: apiKeyRecord?.id,
        webhook_id: webhook?.id,
        request_method: req.method,
        request_path: url.pathname,
        request_body: body,
        response_status: 201,
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      return new Response(
        JSON.stringify({ data, message: 'Cliente criado com sucesso' }),
        { 
          status: 201, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // PUT /api-clientes?id=xxx - Atualizar cliente
    if (req.method === 'PUT') {
      const clienteId = url.searchParams.get('id');
      
      if (!clienteId) {
        await logAudit(supabase, {
          action: 'update_error',
          resource_type: 'clientes',
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          response_status: 400,
          response_body: { error: 'ID não fornecido' },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(
          JSON.stringify({ error: 'ID do cliente é obrigatório como query param: ?id=xxx' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const body = await req.json();
      const updateData: Record<string, unknown> = {};

      // Só atualizar campos enviados
      if (body.nome) updateData.nome = body.nome;
      if (body.numero) updateData.numero = body.numero;
      if (body.produto) updateData.produto = body.produto;
      if (body.data_renovacao) updateData.data_renovacao = body.data_renovacao;
      if (body.email) updateData.email = body.email;
      if (body.cpf) updateData.cpf = body.cpf;
      if (body.plano !== undefined) updateData.plano = body.plano;
      if (body.valor !== undefined) updateData.valor = Number(body.valor);
      if (body.observacao !== undefined) updateData.observacao = body.observacao;

      if (Object.keys(updateData).length === 0) {
        await logAudit(supabase, {
          action: 'update_error',
          resource_type: 'clientes',
          resource_id: clienteId,
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          request_body: body,
          response_status: 400,
          response_body: { error: 'Nenhum campo para atualizar' },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(
          JSON.stringify({ error: 'Nenhum campo para atualizar' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const { data, error } = await supabase
        .from('clientes')
        .update(updateData)
        .eq('id', clienteId)
        .select()
        .single();

      if (error) {
        console.error('Error updating cliente:', error);
        await logAudit(supabase, {
          action: 'update_error',
          resource_type: 'clientes',
          resource_id: clienteId,
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          request_body: body,
          response_status: 500,
          response_body: { error: error.message },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('Cliente updated via API:', clienteId);
      await logAudit(supabase, {
        action: 'update',
        resource_type: 'clientes',
        resource_id: clienteId,
        api_key_id: apiKeyRecord?.id,
        webhook_id: webhook?.id,
        request_method: req.method,
        request_path: url.pathname,
        request_body: body,
        response_status: 200,
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      return new Response(
        JSON.stringify({ data, message: 'Cliente atualizado com sucesso' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // DELETE /api-clientes?id=xxx - Excluir cliente
    if (req.method === 'DELETE') {
      const clienteId = url.searchParams.get('id');
      
      if (!clienteId) {
        await logAudit(supabase, {
          action: 'delete_error',
          resource_type: 'clientes',
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          response_status: 400,
          response_body: { error: 'ID não fornecido' },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(
          JSON.stringify({ error: 'ID do cliente é obrigatório como query param: ?id=xxx' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', clienteId);

      if (error) {
        console.error('Error deleting cliente:', error);
        await logAudit(supabase, {
          action: 'delete_error',
          resource_type: 'clientes',
          resource_id: clienteId,
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          response_status: 500,
          response_body: { error: error.message },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('Cliente deleted via API:', clienteId);
      await logAudit(supabase, {
        action: 'delete',
        resource_type: 'clientes',
        resource_id: clienteId,
        api_key_id: apiKeyRecord?.id,
        webhook_id: webhook?.id,
        request_method: req.method,
        request_path: url.pathname,
        response_status: 200,
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      return new Response(
        JSON.stringify({ message: 'Cliente excluído com sucesso' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Método não suportado' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('API error:', error);
    await logAudit(supabase, {
      action: 'server_error',
      resource_type: 'api',
      request_method: req.method,
      request_path: url.pathname,
      response_status: 500,
      response_body: { error: 'Erro interno' },
      ip_address: ipAddress,
      user_agent: userAgent,
    });
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});