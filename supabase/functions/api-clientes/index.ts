import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// ==================== INPUT VALIDATION ====================

// Validate CPF format (11 digits with valid checksum)
function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  
  // Check for known invalid patterns
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Validate checksum
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
}

// Validate CNPJ format (14 digits with valid checksum)
function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  
  // Check for known invalid patterns
  if (/^(\d)\1{13}$/.test(cleaned)) return false;
  
  // Validate checksum
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i)) * weights1[i];
  }
  let remainder = sum % 11;
  if (remainder < 2) remainder = 0;
  else remainder = 11 - remainder;
  if (remainder !== parseInt(cleaned.charAt(12))) return false;
  
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned.charAt(i)) * weights2[i];
  }
  remainder = sum % 11;
  if (remainder < 2) remainder = 0;
  else remainder = 11 - remainder;
  if (remainder !== parseInt(cleaned.charAt(13))) return false;
  
  return true;
}

// Validate CPF or CNPJ
function isValidCPFOrCNPJ(value: string): boolean {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 11) return isValidCPF(value);
  if (cleaned.length === 14) return isValidCNPJ(value);
  return false;
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 255;
}

// Validate phone number (Brazilian format: 10-11 digits)
function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 11;
}

// Validate string length
function isValidLength(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max;
}

// Validate numeric value
function isValidNumeric(value: number, min: number, max: number): boolean {
  return !isNaN(value) && value >= min && value <= max;
}

// Sanitize string input - remove potentially dangerous characters
function sanitizeString(value: string): string {
  return value
    .replace(/[<>]/g, '') // Remove HTML brackets
    .trim()
    .substring(0, 1000); // Max length
}

// Sanitize search query to prevent SQL injection patterns
function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/[%_]/g, '') // Remove SQL LIKE wildcards
    .replace(/['"\\;]/g, '') // Remove SQL injection characters
    .trim()
    .substring(0, 100);
}

// ==================== ERROR SANITIZATION ====================

// Map internal errors to safe user-facing messages
function getSafeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  
  // Database constraint errors
  if (lowerMessage.includes('duplicate') || lowerMessage.includes('unique')) {
    return 'Registro já existe no sistema';
  }
  if (lowerMessage.includes('foreign key') || lowerMessage.includes('fk_')) {
    return 'Erro de referência: registro relacionado não encontrado';
  }
  if (lowerMessage.includes('not null') || lowerMessage.includes('null value')) {
    return 'Campo obrigatório não preenchido';
  }
  if (lowerMessage.includes('check constraint')) {
    return 'Valor inválido para o campo';
  }
  
  // Connection/timeout errors
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'Tempo de resposta excedido. Tente novamente';
  }
  if (lowerMessage.includes('connection') || lowerMessage.includes('network')) {
    return 'Erro de conexão. Tente novamente';
  }
  
  // Auth errors
  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('auth')) {
    return 'Não autorizado';
  }
  
  // Default safe message
  return 'Erro ao processar requisição';
}

async function getNotificationConfig(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('recovery_config')
    .select('config_key, config_value')
    .in('config_key', ['notify_api_errors', 'notification_email', 'gmail_user', 'gmail_app_password']);
  
  if (!data) return null;
  
  return data.reduce((acc, item) => {
    acc[item.config_key] = item.config_value;
    return acc;
  }, {} as Record<string, string>);
}

// SECURITY: Sanitize PII from error messages to prevent data leakage
function sanitizePII(text: string): string {
  return text
    // Redact emails
    .replace(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
    // Redact CPF patterns (XXX.XXX.XXX-XX or 11 digits)
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[CPF]')
    .replace(/\b\d{11}\b/g, '[CPF]')
    // Redact phone patterns (10-11 digits)
    .replace(/\b\d{10,11}\b/g, '[PHONE]')
    // Redact potential names (First Last pattern) - be conservative
    .replace(/\b[A-Z][a-záàâãéèêíïóôõúç]+ [A-Z][a-záàâãéèêíïóôõúç]+\b/g, '[NOME]');
}

// SECURITY: Mask IP address for privacy
function maskIP(ip: string): string {
  if (!ip) return '[IP_HIDDEN]';
  // Keep only first two octets for IPv4
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  return '[IP_HIDDEN]';
}

async function sendErrorNotification(
  config: Record<string, string>,
  errorDetails: {
    action: string;
    method: string;
    path: string;
    status: number;
    error: string;
    ip: string;
    timestamp: string;
  }
) {
  if (config.notify_api_errors !== 'true' || !config.notification_email || !config.gmail_user || !config.gmail_app_password) {
    return;
  }

  try {
    // SECURITY: Sanitize error message to remove PII and mask IP
    const sanitizedError = sanitizePII(errorDetails.error);
    const maskedIP = maskIP(errorDetails.ip);
    
    const emailBody = `
      <h2>⚠️ Erro na API - Sistema de Clientes</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Ação</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${errorDetails.action}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Método</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${errorDetails.method}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Path</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${errorDetails.path}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Status</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${errorDetails.status}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Erro</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: red;">${sanitizedError}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>IP</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${maskedIP}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Data/Hora</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${errorDetails.timestamp}</td></tr>
      </table>
      <p style="margin-top: 20px; color: #666;">Este é um email automático do sistema de monitoramento.</p>
    `;

    // Send email via SMTP (Gmail)
    const response = await fetch('https://api.smtp2go.com/v3/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: config.gmail_app_password,
        sender: config.gmail_user,
        to: [config.notification_email],
        subject: `[ALERTA] Erro na API - ${errorDetails.action}`,
        html_body: emailBody,
      })
    });

    if (!response.ok) {
      console.error('Failed to send error notification email');
    }
  } catch (err) {
    console.error('Error sending notification:', err);
  }
}

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

    // Send notification if it's an error
    if (data.action.includes('error') || data.action.includes('failed') || data.response_status >= 400) {
      const config = await getNotificationConfig(supabase);
      if (config) {
        await sendErrorNotification(config, {
          action: data.action,
          method: data.request_method,
          path: data.request_path,
          status: data.response_status,
          error: JSON.stringify(data.response_body),
          ip: data.ip_address || 'unknown',
          timestamp: new Date().toISOString(),
        });
      }
    }
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
        response_body: { error: 'Autenticação necessária' },
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
      console.log('Invalid API key attempt');
      await logAudit(supabase, {
        action: 'auth_failed',
        resource_type: 'api',
        request_method: req.method,
        request_path: url.pathname,
        response_status: 401,
        response_body: { error: 'Autenticação inválida' },
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
      const rawSearchQuery = url.searchParams.get('search');
      const searchQuery = rawSearchQuery ? sanitizeSearchQuery(rawSearchQuery) : null;
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);
      const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

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
        const safeError = getSafeErrorMessage(error);
        await logAudit(supabase, {
          action: 'list_error',
          resource_type: 'clientes',
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          response_status: 500,
          response_body: { error: safeError },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(
          JSON.stringify({ error: safeError }),
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

      // Validate required fields
      if (!nome || !numero || !produto || !data_renovacao || !email || !cpf || valor === undefined) {
        await logAudit(supabase, {
          action: 'create_error',
          resource_type: 'clientes',
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          request_body: { fields: Object.keys(body) }, // Don't log actual values
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

      // Validate input formats
      const validationErrors: string[] = [];
      
      if (!isValidLength(String(nome), 2, 200)) {
        validationErrors.push('Nome deve ter entre 2 e 200 caracteres');
      }
      
      if (!isValidEmail(String(email))) {
        validationErrors.push('Email inválido');
      }
      
      if (!isValidCPFOrCNPJ(String(cpf))) {
        validationErrors.push('CPF/CNPJ inválido');
      }
      
      if (!isValidPhone(String(numero))) {
        validationErrors.push('Número de telefone inválido (deve ter 10 ou 11 dígitos)');
      }
      
      const numericValor = Number(valor);
      if (!isValidNumeric(numericValor, 0, 1000000)) {
        validationErrors.push('Valor deve ser entre 0 e 1.000.000');
      }
      
      if (!isValidLength(String(produto), 1, 200)) {
        validationErrors.push('Produto deve ter entre 1 e 200 caracteres');
      }

      if (validationErrors.length > 0) {
        await logAudit(supabase, {
          action: 'create_error',
          resource_type: 'clientes',
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          request_body: { fields: Object.keys(body) },
          response_status: 400,
          response_body: { error: 'Validação falhou', details: validationErrors },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(
          JSON.stringify({ 
            error: 'Erro de validação',
            details: validationErrors
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
          nome: sanitizeString(String(nome)),
          numero: String(numero).replace(/\D/g, ''),
          produto: sanitizeString(String(produto)),
          data_renovacao,
          email: String(email).toLowerCase().trim(),
          cpf: String(cpf).replace(/\D/g, ''),
          plano: plano ? sanitizeString(String(plano)) : null,
          valor: numericValor,
          observacao: observacao ? sanitizeString(String(observacao)) : null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating cliente:', error);
        const safeError = getSafeErrorMessage(error);
        await logAudit(supabase, {
          action: 'create_error',
          resource_type: 'clientes',
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          request_body: { fields: Object.keys(body) },
          response_status: 500,
          response_body: { error: safeError },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(
          JSON.stringify({ error: safeError }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Log to client_history for activity tracking
      await supabase.from('client_history').insert({
        cliente_id: data.id,
        action: 'created',
        previous_data: null,
        new_data: data,
        changed_by: null,
        changed_by_email: `API REST (${apiKeyRecord?.name || webhook?.name || 'unknown'})`,
      });

      console.log('Cliente created via API:', data.id);
      await logAudit(supabase, {
        action: 'create',
        resource_type: 'clientes',
        resource_id: data.id,
        api_key_id: apiKeyRecord?.id,
        webhook_id: webhook?.id,
        request_method: req.method,
        request_path: url.pathname,
        request_body: { fields: Object.keys(body) },
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

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(clienteId)) {
        return new Response(
          JSON.stringify({ error: 'ID inválido' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const body = await req.json();
      const updateData: Record<string, unknown> = {};
      const validationErrors: string[] = [];

      // Validate and sanitize each field
      if (body.nome !== undefined) {
        if (!isValidLength(String(body.nome), 2, 200)) {
          validationErrors.push('Nome deve ter entre 2 e 200 caracteres');
        } else {
          updateData.nome = sanitizeString(String(body.nome));
        }
      }
      
      if (body.numero !== undefined) {
        if (!isValidPhone(String(body.numero))) {
          validationErrors.push('Número de telefone inválido');
        } else {
          updateData.numero = String(body.numero).replace(/\D/g, '');
        }
      }
      
      if (body.produto !== undefined) {
        if (!isValidLength(String(body.produto), 1, 200)) {
          validationErrors.push('Produto deve ter entre 1 e 200 caracteres');
        } else {
          updateData.produto = sanitizeString(String(body.produto));
        }
      }
      
      if (body.data_renovacao !== undefined) {
        updateData.data_renovacao = body.data_renovacao;
      }
      
      if (body.email !== undefined) {
        if (!isValidEmail(String(body.email))) {
          validationErrors.push('Email inválido');
        } else {
          updateData.email = String(body.email).toLowerCase().trim();
        }
      }
      
      if (body.cpf !== undefined) {
        if (!isValidCPFOrCNPJ(String(body.cpf))) {
          validationErrors.push('CPF/CNPJ inválido');
        } else {
          updateData.cpf = String(body.cpf).replace(/\D/g, '');
        }
      }
      
      if (body.plano !== undefined) {
        updateData.plano = body.plano ? sanitizeString(String(body.plano)) : null;
      }
      
      if (body.valor !== undefined) {
        const numericValor = Number(body.valor);
        if (!isValidNumeric(numericValor, 0, 1000000)) {
          validationErrors.push('Valor deve ser entre 0 e 1.000.000');
        } else {
          updateData.valor = numericValor;
        }
      }
      
      if (body.observacao !== undefined) {
        updateData.observacao = body.observacao ? sanitizeString(String(body.observacao)) : null;
      }

      if (validationErrors.length > 0) {
        await logAudit(supabase, {
          action: 'update_error',
          resource_type: 'clientes',
          resource_id: clienteId,
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          request_body: { fields: Object.keys(body) },
          response_status: 400,
          response_body: { error: 'Validação falhou', details: validationErrors },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(
          JSON.stringify({ 
            error: 'Erro de validação',
            details: validationErrors
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      if (Object.keys(updateData).length === 0) {
        await logAudit(supabase, {
          action: 'update_error',
          resource_type: 'clientes',
          resource_id: clienteId,
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          request_body: { fields: Object.keys(body) },
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

      // Get previous data for history logging
      const { data: previousData } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single();

      const { data, error } = await supabase
        .from('clientes')
        .update(updateData)
        .eq('id', clienteId)
        .select()
        .single();

      if (error) {
        console.error('Error updating cliente:', error);
        const safeError = getSafeErrorMessage(error);
        await logAudit(supabase, {
          action: 'update_error',
          resource_type: 'clientes',
          resource_id: clienteId,
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          request_body: { fields: Object.keys(body) },
          response_status: 500,
          response_body: { error: safeError },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(
          JSON.stringify({ error: safeError }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Calculate changed fields
      const changedFields: string[] = [];
      if (previousData) {
        Object.keys(updateData).forEach(key => {
          if (previousData[key] !== updateData[key]) {
            changedFields.push(key);
          }
        });
      }

      // Log to client_history for activity tracking
      await supabase.from('client_history').insert({
        cliente_id: clienteId,
        action: 'updated',
        previous_data: previousData || null,
        new_data: data,
        changed_fields: changedFields.length > 0 ? changedFields : null,
        changed_by: null,
        changed_by_email: `API REST (${apiKeyRecord?.name || webhook?.name || 'unknown'})`,
      });

      console.log('Cliente updated via API:', clienteId);
      await logAudit(supabase, {
        action: 'update',
        resource_type: 'clientes',
        resource_id: clienteId,
        api_key_id: apiKeyRecord?.id,
        webhook_id: webhook?.id,
        request_method: req.method,
        request_path: url.pathname,
        request_body: { fields: Object.keys(body) },
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

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(clienteId)) {
        return new Response(
          JSON.stringify({ error: 'ID inválido' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Get client data before deletion for history logging
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single();

      // Log to client_history BEFORE deletion (required for audit trail)
      if (clienteData) {
        await supabase.from('client_history').insert({
          cliente_id: clienteId,
          action: 'deleted',
          previous_data: clienteData,
          new_data: null,
          changed_by: null,
          changed_by_email: `API REST (${apiKeyRecord?.name || webhook?.name || 'unknown'})`,
        });
      }

      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', clienteId);

      if (error) {
        console.error('Error deleting cliente:', error);
        const safeError = getSafeErrorMessage(error);
        await logAudit(supabase, {
          action: 'delete_error',
          resource_type: 'clientes',
          resource_id: clienteId,
          api_key_id: apiKeyRecord?.id,
          webhook_id: webhook?.id,
          request_method: req.method,
          request_path: url.pathname,
          response_status: 500,
          response_body: { error: safeError },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        return new Response(
          JSON.stringify({ error: safeError }),
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
    const safeError = getSafeErrorMessage(error);
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
