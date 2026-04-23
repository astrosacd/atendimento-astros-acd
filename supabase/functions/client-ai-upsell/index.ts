import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Autenticação necessária" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json().catch(() => ({}));
    const { clienteId, model = "google/gemini-2.0-flash" } = body as {
      clienteId?: string;
      model?: string;
    };

    if (!clienteId) {
      return json({ error: "clienteId é obrigatório" }, 400);
    }

    // Fetch client info, history and available products
    const [clienteRes, historyRes, productsRes] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle(),
      supabase
        .from("client_purchases")
        .select("produto, valor, data_compra")
        .eq("cliente_id", clienteId)
        .order("data_compra", { ascending: false }),
      supabase.from("gateway_products").select("*").eq("status", "active"),
    ]);

    const cliente = clienteRes.data;
    if (!cliente) {
      return json({ error: "Cliente não encontrado" }, 404);
    }

    const context = {
      cliente: {
        nome: cliente.nome,
        produto_atual: cliente.produto,
        plano: cliente.plano,
        tags: cliente.tags,
        observacao: cliente.observacao,
      },
      historico_compras: historyRes.data || [],
      produtos_disponiveis: productsRes.data || [],
    };

    const systemPrompt = `Você é um especialista em vendas e customer success.
Sua tarefa é analisar o histórico de compras de um cliente e os produtos disponíveis na plataforma para sugerir oportunidades de Upsell ou Cross-sell.

Upsell: Sugerir uma versão superior ou mais cara do produto que o cliente já possui.
Cross-sell: Sugerir produtos complementares ao que o cliente já possui.

Retorne APENAS um JSON válido no seguinte formato:
{
  "suggestions": [
    {
      "product_id": "uuid-do-produto",
      "product_name": "Nome do Produto",
      "type": "upsell" | "cross-sell",
      "reason": "Explicação curta de por que este produto é ideal para este cliente agora",
      "confidence": 0-100,
      "estimated_value": number
    }
  ],
  "strategy_summary": "Uma breve explicação da estratégia recomendada para este cliente"
}

Seja realista e baseie-se estritamente nos dados fornecidos. Se não houver boas sugestões, retorne uma lista vazia.`;

    const userPrompt = `Analise o cliente abaixo e sugira produtos:\n\n${JSON.stringify(
      context,
      null,
      2
    )}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ error: "LOVABLE_API_KEY não configurada" }, 500);
    }

    const aiResponse = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);
      return json({ error: "Erro ao comunicar com a IA" }, 500);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content ?? "{}";
    
    let parsedSuggestions;
    try {
        parsedSuggestions = JSON.parse(content);
    } catch (e) {
        console.error("Failed to parse AI response:", content);
        return json({ error: "Resposta da IA em formato inválido" }, 500);
    }

    // Save suggestions to database
    await supabase.from("client_ai_upsell_suggestions").insert({
        cliente_id: clienteId,
        suggestions: parsedSuggestions,
        last_analysis_at: new Date().toISOString()
    });

    return json(parsedSuggestions);

  } catch (error) {
    console.error("client-ai-upsell error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      500
    );
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
