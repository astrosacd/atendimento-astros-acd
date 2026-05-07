import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body = await req.json();
    const { chamado_id, hash_acesso, autor_nome, conteudo, tipo } = body;
    
    if (!conteudo || !autor_nome) {
      return new Response(JSON.stringify({ error: 'Nome e conteúdo são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Validate access - either by hash (public) or by chamado_id (authenticated)
    let chamado;
    
    if (hash_acesso) {
      const { data } = await supabase
        .from('chamados')
        .select('id, email, status')
        .eq('hash_acesso', hash_acesso)
        .single();
      
      if (!data) {
        return new Response(JSON.stringify({ error: 'Chamado não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      chamado = data;
    } else if (chamado_id) {
      // Require JWT authentication for chamado_id path (internal/technician access)
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Autenticação obrigatória' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: claims, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      if (claimsError || !claims?.claims?.sub) {
        return new Response(JSON.stringify({ error: 'Token inválido' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data } = await supabase
        .from('chamados')
        .select('id, email, status')
        .eq('id', chamado_id)
        .single();
      
      if (!data) {
        return new Response(JSON.stringify({ error: 'Chamado não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      chamado = data;
    } else {
      return new Response(JSON.stringify({ error: 'chamado_id ou hash_acesso é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Check if ticket is closed or resolved
    if (chamado.status === 'fechado' || chamado.status === 'resolvido') {
      return new Response(JSON.stringify({ error: 'Não é possível comentar em chamado resolvido ou fechado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Insert comment
    const { data: comentario, error } = await supabase
      .from('chamados_comentarios')
      .insert({
        chamado_id: chamado.id,
        autor_nome: autor_nome.trim(),
        autor_email: hash_acesso ? chamado.email : null,
        tipo: hash_acesso ? 'publico' : (tipo || 'publico'), // Public access can only create public comments
        conteudo: conteudo.trim(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating comment:', error);
      return new Response(JSON.stringify({ error: 'Erro ao criar comentário' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Log history
    await supabase.from('chamados_historico').insert({
      chamado_id: chamado.id,
      acao: 'comentario_adicionado',
      dados_novos: comentario,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
    });
    
    // Trigger webhook
    const { data: chamadoCompleto } = await supabase
      .from('chamados')
      .select('*')
      .eq('id', chamado.id)
      .single();
    
    // Trigger chamado.atualizado webhook
    const { data: webhooks } = await supabase
      .from('chamados_webhooks')
      .select('*')
      .eq('is_active', true)
      .contains('eventos', ['chamado.atualizado']);
    
    if (webhooks?.length) {
      for (const webhook of webhooks) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (webhook.secret_key) headers['X-Webhook-Secret'] = webhook.secret_key;
          
          await fetch(webhook.url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              evento: 'chamado.atualizado',
              timestamp: new Date().toISOString(),
              data: { ...chamadoCompleto, comentario },
            }),
          });
        } catch (err) {
          console.error('Webhook error:', err);
        }
      }
    }
    
    return new Response(JSON.stringify({ success: true, comentario }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (err) {
    console.error('Comment Error:', err);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
