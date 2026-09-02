import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

// Compat: some SMTP libs depend on Deno.writeAll (not available in Edge runtime)
// deno-lint-ignore no-explicit-any
if (!(Deno as any).writeAll) {
  // deno-lint-ignore no-explicit-any
  (Deno as any).writeAll = async (writer: any, data: Uint8Array) => {
    let offset = 0;
    while (offset < data.length) {
      offset += await writer.write(data.subarray(offset));
    }
  };
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-temp-access-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Generate unique ticket code in format ACD-YYYYMMDDHHMMSS (Brazil timezone)
function generateTicketCode(): string {
  const now = new Date();
  const brazilTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  
  const year = brazilTime.getFullYear();
  const month = String(brazilTime.getMonth() + 1).padStart(2, '0');
  const day = String(brazilTime.getDate()).padStart(2, '0');
  const hours = String(brazilTime.getHours()).padStart(2, '0');
  const minutes = String(brazilTime.getMinutes()).padStart(2, '0');
  const seconds = String(brazilTime.getSeconds()).padStart(2, '0');
  
  return `ACD-${year}${month}${day}${hours}${minutes}${seconds}`;
}

// Generate secure hash for access
function generateAccessHash(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Validate API key and get permissions
async function validateApiKey(supabase: any, apiKey: string): Promise<{ valid: boolean; permissions: string[] }> {
  if (!apiKey) return { valid: false, permissions: [] };
  
  const { data, error } = await supabase
    .from('chamados_api_keys')
    .select('id, permissions, is_active')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .maybeSingle();
  
  if (error || !data) return { valid: false, permissions: [] };
  
  // Update last used
  await supabase
    .from('chamados_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);
  
  return { valid: true, permissions: data.permissions || [] };
}

// Trigger webhooks for an event
async function triggerWebhooks(supabase: any, evento: string, chamado: any) {
  try {
    const { data: webhooks } = await supabase
      .from('chamados_webhooks')
      .select('*')
      .eq('is_active', true)
      .contains('eventos', [evento]);
    
    if (!webhooks?.length) return;
    
    const payload = {
      evento,
      timestamp: new Date().toISOString(),
      data: chamado,
    };
    
    for (const webhook of webhooks) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (webhook.secret_key) {
          headers['X-Webhook-Secret'] = webhook.secret_key;
        }
        
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        
        // Log webhook delivery
        await supabase.from('chamados_webhook_logs').insert({
          webhook_id: webhook.id,
          chamado_id: chamado.id,
          evento,
          payload,
          response_status: response.status,
          response_body: await response.text().catch(() => ''),
          success: response.ok,
        });
        
        // Update last triggered
        await supabase
          .from('chamados_webhooks')
          .update({ last_triggered_at: new Date().toISOString() })
          .eq('id', webhook.id);
          
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Webhook error for ${webhook.nome}:`, err);
        await supabase.from('chamados_webhook_logs').insert({
          webhook_id: webhook.id,
          chamado_id: chamado.id,
          evento,
          payload,
          response_status: 0,
          response_body: errorMessage,
          success: false,
        });
      }
    }
  } catch (err) {
    console.error('Error triggering webhooks:', err);
  }
}

// Get email base URL from config
async function getEmailBaseUrl(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from("chamados_config")
      .select("config_value")
      .eq("config_key", "email_base_url")
      .maybeSingle();
    
    return data?.config_value || "https://atendimento-astros-acd.lovable.app";
  } catch {
    return "https://atendimento-astros-acd.lovable.app";
  }
}

// Send email via Gmail SMTP (configurado pelo painel em chamados_config)
async function sendEmail(supabase: any, to: string, subject: string, html: string) {
  const safeTo = String(to || "").trim();
  if (!safeTo) return false;

  try {
    const { data: configs, error } = await supabase
      .from("chamados_config")
      .select("config_key, config_value")
      .in("config_key", ["smtp_enabled", "smtp_sender_name", "smtp_gmail_user", "smtp_gmail_app_password"]);

    if (error) throw error;

    const configMap: Record<string, string> = {};
    configs?.forEach((c: any) => {
      configMap[c.config_key] = c.config_value;
    });

    const smtpEnabled = configMap.smtp_enabled === "true";
    const gmailUser = configMap.smtp_gmail_user;
    const gmailPassword = configMap.smtp_gmail_app_password;
    const senderName = configMap.smtp_sender_name || "Sistema de Chamados";

    if (!smtpEnabled || !gmailUser || !gmailPassword) {
      console.log("SMTP not configured (panel values missing), skipping email");
      return false;
    }

    const client = new SmtpClient();
    try {
      await client.connectTLS({
        hostname: "smtp.gmail.com",
        port: 465,
        username: gmailUser,
        password: gmailPassword,
      });

      await client.send({
        from: `${senderName} <${gmailUser}>`,
        to: safeTo,
        subject,
        content: "Visualize este email em um cliente com suporte a HTML",
        html,
      });

      console.log(`Email sent to ${safeTo}: ${subject}`);
      return true;
    } finally {
      try {
        await client.close();
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.error("Error sending email:", err);
    return false;
  }
}


serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const url = new URL(req.url);
    const apiKey = req.headers.get('x-api-key') || '';
    
    // Validate API key for authenticated endpoints
    const { valid: apiKeyValid, permissions } = await validateApiKey(supabase, apiKey);
    
    // GET - List or search tickets
    if (req.method === "GET") {
      // Public access for hash lookup
      const hash = url.searchParams.get('hash');
      if (hash) {
        const { data, error } = await supabase
          .from('chamados')
          .select(`
            id, codigo, nome, email, contato, motivo, status, prioridade, created_at, updated_at, closed_at, is_internal, setor, cliente_id,
            chamados_comentarios(id, autor_nome, tipo, conteudo, created_at)
          `)
          .eq('hash_acesso', hash)
          .eq('is_internal', false) // Public lookup only for non-internal
          .maybeSingle();
        
        if (error || !data) {
          return new Response(JSON.stringify({ error: 'Chamado não encontrado' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Filter to only public comments for hash access
        if (data.chamados_comentarios) {
          data.chamados_comentarios = data.chamados_comentarios.filter((c: any) => c.tipo === 'publico');
        }
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // API key required for other operations
      if (!apiKeyValid || !permissions.includes('read')) {
        return new Response(JSON.stringify({ error: 'API key inválida ou sem permissão' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const id = url.searchParams.get('id');
      const codigo = url.searchParams.get('codigo');
      const email = url.searchParams.get('email');
      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      
      let query = supabase
        .from('chamados')
        .select(`
          id, codigo, nome, email, contato, motivo, status, prioridade, tecnico_id, created_at, updated_at, closed_at, is_internal, setor, cliente_id, criado_por,
          chamados_comentarios(id, autor_nome, autor_email, tipo, conteudo, created_at)
        `, { count: 'exact' });
      
      if (id) query = query.eq('id', id);
      if (codigo) query = query.eq('codigo', codigo);
      if (email) query = query.eq('email', email);
      if (status) query = query.eq('status', status);
      
      const isInternal = url.searchParams.get('is_internal');
      if (isInternal === 'true') query = query.eq('is_internal', true);
      else if (isInternal === 'false') query = query.eq('is_internal', false);
      
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      
      const { data, error, count } = await query;
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ data, total: count, limit, offset }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // POST - Create new ticket (public access) + Public lookups
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      // Public lookup by code/hash (used by the public portal)
      if (body?.action === "buscar_por_codigo") {
        const codigo = String(body.codigo || "").trim().toUpperCase();
        if (!codigo) {
          return new Response(JSON.stringify({ error: "Código do chamado é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabase
          .from("chamados")
          .select(
            `
            id, codigo, nome, email, contato, motivo, status, prioridade, hash_acesso, created_at, updated_at, closed_at, is_internal, setor,
            chamados_comentarios(id, autor_nome, tipo, conteudo, created_at)
          `
          )
          .eq("codigo", codigo)
          .eq("is_internal", false)
          .maybeSingle();

        if (error || !data) {
          return new Response(JSON.stringify({ error: "Chamado não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Only public comments
        if (data.chamados_comentarios) {
          data.chamados_comentarios = data.chamados_comentarios.filter((c: any) => c.tipo === "publico");
        }

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body?.action === "buscar_por_hash") {
        const hash = String(body.hash || "").trim();
        if (!hash) {
          return new Response(JSON.stringify({ error: "Hash é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabase
          .from("chamados")
          .select(
            `
            id, codigo, nome, email, contato, motivo, status, prioridade, hash_acesso, created_at, updated_at, closed_at, is_internal, setor,
            chamados_comentarios(id, autor_nome, tipo, conteudo, created_at)
          `
          )
          .eq("hash_acesso", hash)
          .eq("is_internal", false)
          .maybeSingle();

        if (error || !data) {
          return new Response(JSON.stringify({ error: "Chamado não encontrado" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Only public comments
        if (data.chamados_comentarios) {
          data.chamados_comentarios = data.chamados_comentarios.filter((c: any) => c.tipo === "publico");
        }

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create new ticket
      const { nome, email, contato, motivo, is_internal, setor, cliente_id, prioridade: bodyPrioridade, criado_por } = body;

      // Validate required fields
      if (!nome || !email || !contato || !motivo) {
        return new Response(JSON.stringify({ error: "Campos obrigatórios: nome, email, contato, motivo" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(JSON.stringify({ error: "Email inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const codigo = generateTicketCode();
      const hashAcesso = generateAccessHash();

      const { data, error } = await supabase
        .from("chamados")
        .insert({
          codigo,
          nome: String(nome).trim(),
          email: String(email).trim().toLowerCase(),
          contato: String(contato).trim(),
          motivo: String(motivo).trim(),
          hash_acesso: hashAcesso,
          is_internal: !!is_internal,
          setor: setor || null,
          cliente_id: cliente_id || null,
          criado_por: criado_por || null,
          prioridade: bodyPrioridade || 'media'
        })
        .select(
          "id, codigo, nome, email, contato, motivo, status, prioridade, hash_acesso, created_at, updated_at, closed_at, is_internal, setor, cliente_id"
        )
        .single();

      if (error) {
        console.error("Error creating ticket:", error);
        return new Response(JSON.stringify({ error: "Erro ao criar chamado" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log history
      await supabase.from("chamados_historico").insert({
        chamado_id: data.id,
        acao: "criado",
        dados_novos: data,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      });

      // Trigger webhooks
      await triggerWebhooks(supabase, "chamado.criado", data);

      // Get configured base URL for email links
      const emailBaseUrl = await getEmailBaseUrl(supabase);

      // Send confirmation email
      await sendEmail(
        supabase,
        String(email),
        `Chamado ${codigo} aberto com sucesso`,
        `<h2>Seu chamado foi registrado!</h2>
        <p>Código: <strong>${codigo}</strong></p>
        <p>Acompanhe seu chamado através do link abaixo:</p>
        <a href="${emailBaseUrl}/chamados/acompanhar?hash=${hashAcesso}">Acompanhar Chamado</a>`
      );

      return new Response(
        JSON.stringify({
          success: true,
          chamado: data,
        }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // PUT - Update ticket (requires API key with write permission)
    if (req.method === "PUT") {
      if (!apiKeyValid || !permissions.includes('write')) {
        return new Response(JSON.stringify({ error: 'API key inválida ou sem permissão de escrita' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'ID do chamado é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Get current data
      const { data: currentData } = await supabase
        .from('chamados')
        .select('*')
        .eq('id', id)
        .single();
      
      if (!currentData) {
        return new Response(JSON.stringify({ error: 'Chamado não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const body = await req.json();
      const allowedFields = ['status', 'prioridade', 'tecnico_id'];
      const updateData: Record<string, any> = {};
      
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }
      
      // Encerramento = resolvido OU fechado; reabertura limpa a data
      const encerrados = ['fechado', 'resolvido'];
      if (updateData.status && updateData.status !== currentData.status) {
        if (encerrados.includes(updateData.status as string)) {
          updateData.closed_at = new Date().toISOString();
        } else if (encerrados.includes(currentData.status as string)) {
          updateData.closed_at = null;
        }
      }
      
      const { data, error } = await supabase
        .from('chamados')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Log history
      await supabase.from('chamados_historico').insert({
        chamado_id: id,
        acao: 'atualizado',
        dados_anteriores: currentData,
        dados_novos: data,
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      });
      
      // Trigger webhooks
      const evento = updateData.status === 'fechado' ? 'chamado.fechado' : 'chamado.atualizado';
      await triggerWebhooks(supabase, evento, data);
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // DELETE - Delete ticket (requires API key with delete permission)
    if (req.method === "DELETE") {
      if (!apiKeyValid || !permissions.includes('delete')) {
        return new Response(JSON.stringify({ error: 'API key inválida ou sem permissão de exclusão' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'ID do chamado é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const { error } = await supabase
        .from('chamados')
        .delete()
        .eq('id', id);
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (err) {
    console.error('API Error:', err);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
