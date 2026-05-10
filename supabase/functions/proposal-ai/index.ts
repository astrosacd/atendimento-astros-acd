import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-3-flash-preview";

function safeJsonFromContent(content: string) {
  console.log("Processando conteúdo para JSON...");
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  
  if (jsonStart === -1 || jsonEnd === -1) {
    console.error("JSON não encontrado no conteúdo:", content);
    throw new Error("A IA não retornou um formato JSON válido.");
  }

  const jsonText = cleaned.slice(jsonStart, jsonEnd + 1);
  
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed?.title || !Array.isArray(parsed?.sections)) {
      console.error("JSON incompleto:", parsed);
      throw new Error("Resposta da IA veio incompleta (faltando título ou seções)");
    }
    return parsed;
  } catch (e) {
    console.error("Erro ao fazer parse do JSON:", e);
    console.error("Texto que falhou:", jsonText);
    throw new Error("Erro ao processar dados da IA: " + e.message);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, context, currentContent, sectionType, fullProposalRequest } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY não encontrada");
      throw new Error("Configuração de IA ausente");
    }

    let systemPrompt = "";
    let userPromptContent = "";

    if (action === "generate_full_proposal") {
      systemPrompt = `Você é um especialista em estruturação de propostas comerciais no Brasil.
Retorne APENAS um JSON válido. Não inclua texto explicativo antes ou depois.

Formato JSON esperado:
{
  "title": "Título Profissional da Proposta",
  "sections": [
    {
      "type": "cover",
      "title": "Capa",
      "content": { "title": "Nome do Projeto", "subtitle": "Apresentação de Soluções" }
    },
    {
      "type": "text",
      "title": "Apresentação",
      "content": { "content": "Texto markdown profissional sobre a empresa e solução..." }
    },
    {
      "type": "pricing",
      "title": "Investimento",
      "content": { "items": [{ "description": "Serviço X", "quantity": 1, "unitPrice": 1500 }] }
    },
    {
      "type": "terms",
      "title": "Condições",
      "content": { "content": "Prazos de entrega, validade da proposta e formas de pagamento..." }
    }
  ]
}

Regras:
- Tipos de seção permitidos: cover, text, pricing, timeline, terms, gallery.
- Linguagem: Português do Brasil (PT-BR).
- Tom: Profissional, consultivo e persuasivo.`;

      userPromptContent = `O cliente solicitou uma proposta com estas instruções: ${fullProposalRequest || context || "Gere uma proposta comercial padrão."}
Baseado nisso, estruture a proposta completa com título e seções relevantes.`;
    } else {
      systemPrompt = "Você é um redator sênior de propostas comerciais. Melhore o texto fornecido mantendo um tom profissional e direto. Retorne apenas o texto final em Markdown.";
      userPromptContent = `Ação solicitada: ${action}
Tipo da seção: ${sectionType || 'geral'}
Conteúdo atual: ${currentContent || '(vazio)'}
Instruções adicionais: ${context || fullProposalRequest || 'Gere um conteúdo profissional e persuasivo para esta seção.'}

Retorne apenas o texto em Markdown.`;
    }

    console.log(`Chamando AI Gateway com modelo: ${AI_MODEL}`);
    console.log("Prompt do sistema:", systemPrompt.substring(0, 100) + "...");
    console.log("Prompt do usuário:", userPromptContent.substring(0, 100) + "...");
    
    const requestBody: Record<string, unknown> = {
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPromptContent },
      ],
    };

    const response = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Erro na API da OpenAI/Gateway:", response.status, errorData);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "A IA recebeu muitos pedidos agora. Aguarde um pouco e tente novamente." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Os créditos de IA acabaram. Adicione créditos em Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Falha na IA (${response.status}): ${errorData}`);
    }

    const aiData = await response.json();
    console.log("Resposta recebida da AI Gateway");
    const content = aiData?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("Conteúdo ausente na resposta da IA:", JSON.stringify(aiData));
      throw new Error("A IA não retornou conteúdo");
    }
    console.log("Conteúdo gerado com sucesso, tamanho:", content.length);

    if (action === "generate_full_proposal") {
      const proposalJson = safeJsonFromContent(content);
      return new Response(JSON.stringify(proposalJson), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text: content.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro geral na function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
