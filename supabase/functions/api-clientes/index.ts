import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar API Key do header
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey) {
      console.log('API request without API key');
      return new Response(
        JSON.stringify({ error: 'API key é obrigatória. Use o header x-api-key' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verificar se a API key existe e está ativa nos webhooks
    const { data: webhook, error: webhookError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('secret_key', apiKey)
      .eq('is_active', true)
      .single();

    if (webhookError || !webhook) {
      console.log('Invalid API key attempt:', apiKey);
      return new Response(
        JSON.stringify({ error: 'API key inválida ou inativa' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('API request authenticated for webhook:', webhook.name);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[pathParts.length - 1];

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
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`Listed ${data?.length} clientes`);
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
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('Cliente created via API:', data.id);
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
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('Cliente updated via API:', clienteId);
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
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('Cliente deleted via API:', clienteId);
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
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
