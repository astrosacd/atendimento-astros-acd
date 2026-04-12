import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PROMPT = `Você é um analista de negócios especializado em SaaS e gestão de clientes. Analise os dados abaixo e forneça:

1. **Resumo da Situação Atual** - Uma visão geral do estado do negócio
2. **Pontos de Atenção** - Problemas ou riscos identificados
3. **Clientes em Risco** - Se houver dados de clientes com renovação próxima ou atrasada, liste-os
4. **Recomendações Práticas** - Ações específicas para melhorar as métricas
5. **Oportunidades** - Sugestões de crescimento

Seja direto, prático e use bullet points. Foque em ações que podem ser tomadas imediatamente.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { provider, model, customPrompt, metricsData, openaiApiKey, grokApiKey } = await req.json();

    const aiProvider = provider || "lovable";
    const aiModel = model || "google/gemini-3-flash-preview";
    const promptToUse = customPrompt || DEFAULT_PROMPT;

    // Build metrics message
    const metricsMessage = `Dados do negócio para análise:\n\n${JSON.stringify(metricsData, null, 2)}`;

    let responseText = "";
    let apiUrl = "";
    let apiKey = "";
    let requestBody: any = {};

    if (aiProvider === "lovable") {
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
      requestBody = {
        model: aiModel,
        messages: [
          { role: "system", content: promptToUse },
          { role: "user", content: metricsMessage },
        ],
      };
    } else if (aiProvider === "openai") {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      apiKey = openaiApiKey || "";
      requestBody = {
        model: aiModel || "gpt-4o",
        messages: [
          { role: "system", content: promptToUse },
          { role: "user", content: metricsMessage },
        ],
      };
    } else if (aiProvider === "grok") {
      apiUrl = "https://api.x.ai/v1/chat/completions";
      apiKey = grokApiKey || "";
      requestBody = {
        model: aiModel || "grok-3",
        messages: [
          { role: "system", content: promptToUse },
          { role: "user", content: metricsMessage },
        ],
      };
    }

    if (!apiKey) {
      throw new Error(`API key não configurada para o provedor: ${aiProvider}`);
    }

    console.log(`[reports-ai] Calling ${aiProvider} with model ${requestBody.model}`);

    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`[reports-ai] AI error ${aiResponse.status}:`, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error("Limite de requisições atingido. Tente novamente em alguns minutos.");
      }
      if (aiResponse.status === 402) {
        throw new Error("Créditos insuficientes. Adicione créditos na sua conta.");
      }
      throw new Error(`Erro do provedor de IA (${aiResponse.status})`);
    }

    const aiData = await aiResponse.json();
    responseText = aiData.choices?.[0]?.message?.content || "Sem resposta da IA";

    // Save to history
    await supabase.from("reports_analysis_history").insert({
      analysis_text: responseText,
      ai_provider: aiProvider,
      ai_model: requestBody.model,
      prompt_used: promptToUse,
      metrics_snapshot: metricsData,
    });

    return new Response(JSON.stringify({
      success: true,
      analysis: responseText,
      provider: aiProvider,
      model: requestBody.model,
      prompt: promptToUse,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[reports-ai] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});