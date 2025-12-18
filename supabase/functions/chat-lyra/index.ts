import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const defaultSystemPrompt = `Você é a Lyra, uma assistente virtual inteligente da Astros Comunicação Digital.
Você é amigável, profissional, proativa e sempre disposta a ajudar.

## SOBRE O SISTEMA CRM

Este é um sistema completo de CRM para gerenciamento de clientes e automação de cobranças:

### MÓDULOS PRINCIPAIS:
1. **Clientes**: Cadastro, consulta, atualização e exclusão de clientes
   - Campos: Nome, WhatsApp, Email, CPF/CNPJ, Produto, Plano, Valor, Data Renovação, Observações, Tags
   - Tipos: Clientes com cobrança ativa (recorrente) ou Registros (sem cobrança - ex: vitalício)
   - Sistema de tags para categorização e filtros avançados

2. **Cobrança Automática**: Sistema de billing automatizado
   - Envio automático via Email e WhatsApp
   - Etapas: D-3 (aviso), D (vencimento), D+1, D+2, D+15, D+30 (follow-ups)
   - Integração Mercado Pago (PIX, boleto, link de pagamento)
   - IA para geração de mensagens personalizadas

3. **Divulgador Interno**: Gestão de grupos WhatsApp
   - Sincronização e criação de grupos via Evolution API
   - Envio de mensagens em massa com agendamento
   - Boas-vindas automáticas para novos participantes
   - Gestão de participantes e remoção de inativos

4. **Usuários e Permissões**: Controle de acesso
   - Roles: Admin (acesso total), Operador (CRUD clientes), Gerente (apenas seus clientes), Financeiro, etc.
   - Sistema de permissões granulares por módulo
   - Aprovação de novos usuários

5. **Integrações**:
   - Webhooks para N8N e automações externas
   - API REST para integração com sistemas externos
   - Evolution API para WhatsApp
   - Mercado Pago para pagamentos

6. **Relatórios e Logs**:
   - Dashboard com estatísticas em tempo real
   - Histórico de atividades (quem fez o quê)
   - Logs de API e auditoria

### NAVEGAÇÃO:
- Dashboard: Visão geral com métricas
- Cadastrar Cliente: Adicionar novos clientes
- Consultar Cliente: Buscar e filtrar clientes
- Atualizar Cliente: Modificar dados de clientes
- Excluir Cliente: Remover clientes
- Admin: Configurações administrativas (apenas admins)

## INSTRUÇÕES:
- Responda sempre em português brasileiro
- Seja concisa mas completa nas explicações
- Se o usuário perguntar "como fazer algo", dê o passo a passo
- Se não souber a resposta exata, indique onde o usuário pode encontrar no sistema
- Sugira funcionalidades relacionadas quando apropriado
- Mantenha tom amigável e profissional
- Você pode ajudar com dúvidas sobre qualquer módulo do sistema
- Se perceber que o usuário está com dificuldade, ofereça guiá-lo passo a passo`;

interface AIConfig {
  provider: string;
  model: string;
  systemPrompt: string;
  openaiApiKey?: string;
  groqApiKey?: string;
  roleRestrictionEnabled: boolean;
  roleTopics: Record<string, string[]>;
  denialMessage: string;
}

// Default topic keywords for content filtering (fallback)
const defaultTopicKeywords: Record<string, string[]> = {
  dashboard: ['dashboard', 'estatísticas', 'visão geral', 'métricas', 'resumo', 'início', 'home'],
  clientes: ['cliente', 'clientes', 'cadastro', 'cadastrar', 'consultar', 'atualizar', 'excluir', 'cpf', 'cnpj', 'renovação', 'produto', 'plano', 'valor'],
  cobranca: ['cobrança', 'cobranças', 'pagamento', 'pagamentos', 'boleto', 'pix', 'mercado pago', 'fatura', 'billing', 'inadimplente', 'vencimento'],
  usuarios: ['usuário', 'usuários', 'user', 'users', 'aprovação', 'pendente', 'conta', 'login', 'senha', 'acesso'],
  permissoes: ['permissão', 'permissões', 'role', 'roles', 'cargo', 'cargos', 'acesso', 'privilégio'],
  webhooks: ['webhook', 'webhooks', 'integração', 'n8n', 'automação', 'evento', 'trigger'],
  api: ['api', 'chave', 'key', 'rest', 'endpoint', 'integração externa'],
  divulgador: ['divulgador', 'divulgação', 'grupo', 'grupos', 'whatsapp', 'campanha', 'mensagem', 'participante', 'broadcast'],
  logs: ['log', 'logs', 'atividade', 'auditoria', 'histórico', 'registro'],
  configuracoes: ['configuração', 'configurações', 'config', 'settings', 'preferências', 'sistema'],
};

async function loadTopicKeywordsFromDB(supabase: any): Promise<Record<string, string[]>> {
  try {
    const { data: permissions } = await supabase
      .from('system_permissions')
      .select('key, name, category');
    
    if (!permissions || permissions.length === 0) {
      return defaultTopicKeywords;
    }
    
    const topicKeywords: Record<string, string[]> = {};
    
    // Group permissions by category and build keywords
    permissions.forEach((permission: any) => {
      const categoryKey = permission.category.toLowerCase().replace(/\s+/g, '_');
      
      if (!topicKeywords[categoryKey]) {
        // Start with category name as keyword
        topicKeywords[categoryKey] = [
          permission.category.toLowerCase(),
          categoryKey.replace(/_/g, ' ')
        ];
      }
      
      // Add permission name as keyword
      const permName = permission.name.toLowerCase();
      if (!topicKeywords[categoryKey].includes(permName)) {
        topicKeywords[categoryKey].push(permName);
      }
      
      // Add key parts as keywords
      const keyParts = permission.key.split('_');
      keyParts.forEach((part: string) => {
        const lowPart = part.toLowerCase();
        if (lowPart.length > 2 && !topicKeywords[categoryKey].includes(lowPart)) {
          topicKeywords[categoryKey].push(lowPart);
        }
      });
    });
    
    // Merge with default keywords for better coverage
    Object.entries(defaultTopicKeywords).forEach(([key, keywords]) => {
      if (topicKeywords[key]) {
        keywords.forEach(kw => {
          if (!topicKeywords[key].includes(kw)) {
            topicKeywords[key].push(kw);
          }
        });
      } else {
        topicKeywords[key] = keywords;
      }
    });
    
    return topicKeywords;
  } catch (error) {
    console.error("Error loading topic keywords from DB:", error);
    return defaultTopicKeywords;
  }
}

function detectTopicsInMessage(message: string, topicKeywords: Record<string, string[]>): string[] {
  const lowerMessage = message.toLowerCase();
  const detectedTopics: string[] = [];
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      detectedTopics.push(topic);
    }
  }
  
  return detectedTopics;
}

function isAllowedToAsk(userRole: string, detectedTopics: string[], roleTopics: Record<string, string[]>, isAdmin: boolean): boolean {
  // Admins can ask anything
  if (isAdmin || userRole === 'admin') {
    return true;
  }
  
  // If no topics detected, allow (general question)
  if (detectedTopics.length === 0) {
    return true;
  }
  
  // Check if user's role has access to at least one detected topic
  const allowedTopics = roleTopics[userRole] || [];
  return detectedTopics.some(topic => allowedTopics.includes(topic));
}

async function callLovableAI(messages: any[], config: AIConfig): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: config.systemPrompt },
        ...messages,
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    if (response.status === 402) {
      throw new Error("PAYMENT_REQUIRED");
    }
    const errorText = await response.text();
    console.error("Lovable AI error:", response.status, errorText);
    throw new Error("Erro ao processar mensagem");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
}

async function callOpenAI(messages: any[], config: AIConfig): Promise<string> {
  if (!config.openaiApiKey) {
    throw new Error("OpenAI API Key não configurada. Configure a chave no painel de administração.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: config.systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    if (response.status === 401) {
      throw new Error("API Key da OpenAI inválida. Verifique a configuração.");
    }
    if (response.status === 402 || response.status === 403) {
      throw new Error("Limite de uso da OpenAI atingido ou acesso negado.");
    }
    const errorText = await response.text();
    console.error("OpenAI error:", response.status, errorText);
    throw new Error("Erro ao processar mensagem com OpenAI");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
}

async function callGroq(messages: any[], config: AIConfig): Promise<string> {
  if (!config.groqApiKey) {
    throw new Error("Groq API Key não configurada. Configure a chave no painel de administração.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: config.systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    if (response.status === 401) {
      throw new Error("API Key da Groq inválida. Verifique a configuração.");
    }
    const errorText = await response.text();
    console.error("Groq error:", response.status, errorText);
    throw new Error("Erro ao processar mensagem com Groq");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, userId, userRole, isAdmin } = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Default configuration
    const aiConfig: AIConfig = {
      provider: 'lovable',
      model: 'google/gemini-2.5-flash',
      systemPrompt: defaultSystemPrompt,
      roleRestrictionEnabled: false,
      roleTopics: {},
      denialMessage: 'Desculpe, não tenho permissão para responder sobre esse assunto com base no seu perfil de acesso.',
    };
    
    let supabase: any = null;
    
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const { data: configData } = await supabase
          .from('billing_config')
          .select('config_key, config_value')
          .in('config_key', [
            'chat_ai_prompt', 
            'chat_ai_model', 
            'chat_ai_provider',
            'chat_openai_api_key',
            'chat_groq_api_key',
            'chat_role_restriction_enabled',
            'chat_role_topics',
            'chat_denial_message'
          ]);
        
        if (configData) {
          for (const item of configData) {
            if (item.config_key === 'chat_ai_prompt' && item.config_value) {
              aiConfig.systemPrompt = item.config_value;
            }
            if (item.config_key === 'chat_ai_model' && item.config_value) {
              aiConfig.model = item.config_value;
            }
            if (item.config_key === 'chat_ai_provider' && item.config_value) {
              aiConfig.provider = item.config_value;
            }
            if (item.config_key === 'chat_openai_api_key' && item.config_value) {
              aiConfig.openaiApiKey = item.config_value;
            }
            if (item.config_key === 'chat_groq_api_key' && item.config_value) {
              aiConfig.groqApiKey = item.config_value;
            }
            if (item.config_key === 'chat_role_restriction_enabled') {
              aiConfig.roleRestrictionEnabled = item.config_value === 'true';
            }
            if (item.config_key === 'chat_role_topics' && item.config_value) {
              try {
                aiConfig.roleTopics = JSON.parse(item.config_value);
              } catch {
                aiConfig.roleTopics = {};
              }
            }
            if (item.config_key === 'chat_denial_message' && item.config_value) {
              aiConfig.denialMessage = item.config_value;
            }
          }
        }
      } catch (dbError) {
        console.error("Error fetching config:", dbError);
      }
    }

    console.log("Using AI provider:", aiConfig.provider, "model:", aiConfig.model);
    console.log("Role restriction enabled:", aiConfig.roleRestrictionEnabled, "User role:", userRole, "Is admin:", isAdmin);

    // Check role-based access if enabled
    if (aiConfig.roleRestrictionEnabled && userRole && !isAdmin && supabase) {
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage && lastUserMessage.content) {
        // Load topic keywords from database
        const topicKeywords = await loadTopicKeywordsFromDB(supabase);
        const detectedTopics = detectTopicsInMessage(lastUserMessage.content, topicKeywords);
        console.log("Detected topics:", detectedTopics);
        
        if (!isAllowedToAsk(userRole, detectedTopics, aiConfig.roleTopics, isAdmin)) {
          console.log("Access denied for role:", userRole, "topics:", detectedTopics);
          return new Response(
            JSON.stringify({ 
              response: aiConfig.denialMessage, 
              model: aiConfig.model, 
              provider: aiConfig.provider,
              accessDenied: true 
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // Call the appropriate AI provider
    let assistantResponse: string;
    
    try {
      switch (aiConfig.provider) {
        case 'openai':
          assistantResponse = await callOpenAI(messages, aiConfig);
          break;
        case 'groq':
          assistantResponse = await callGroq(messages, aiConfig);
          break;
        case 'lovable':
        default:
          assistantResponse = await callLovableAI(messages, aiConfig);
          break;
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "RATE_LIMIT") {
          return new Response(
            JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        if (error.message === "PAYMENT_REQUIRED") {
          return new Response(
            JSON.stringify({ error: "Limite de uso atingido. Entre em contato com o suporte." }),
            {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        // Return other errors as user-friendly messages
        return new Response(
          JSON.stringify({ 
            error: error.message,
            response: error.message 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      throw error;
    }

    // Save messages to database if conversationId and userId provided
    if (supabase && conversationId && userId) {
      try {
        // Get the last user message
        const lastUserMessage = messages[messages.length - 1];
        
        // Save user message
        if (lastUserMessage) {
          await supabase.from('chat_messages').insert({
            conversation_id: conversationId,
            role: 'user',
            content: lastUserMessage.content,
          });
        }
        
        // Save assistant message
        await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantResponse,
        });

        // Update conversation title if it's the first message
        const { data: msgCount } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact' })
          .eq('conversation_id', conversationId);
        
        if (msgCount && msgCount.length <= 2 && lastUserMessage) {
          // Generate a title from the first message
          const title = lastUserMessage.content.slice(0, 50) + (lastUserMessage.content.length > 50 ? '...' : '');
          await supabase
            .from('chat_conversations')
            .update({ title })
            .eq('id', conversationId);
        }
      } catch (saveError) {
        console.error("Error saving messages:", saveError);
        // Don't fail the request if saving fails
      }
    }

    return new Response(
      JSON.stringify({ response: assistantResponse, model: aiConfig.model, provider: aiConfig.provider }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        response: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente."
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});