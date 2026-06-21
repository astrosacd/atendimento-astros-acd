import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-temp-access-token",
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

    // Public client using only anon key to bypass user-specific RLS if needed for product data
    const publicClient = createClient(supabaseUrl, supabaseAnonKey);

    const body = await req.json().catch(() => ({}));
    const { clienteId, model = "google/gemini-2.5-flash" } = body as {
      clienteId?: string;
      model?: string;
    };

    if (!clienteId) {
      return json({ error: "clienteId é obrigatório" }, 400);
    }

    // Fetch client info, history, available products and followups
    const [clienteRes, historyRes, productsRes, popularRes, followupsRes] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle(),
      supabase
        .from("client_purchases")
        .select("produto, valor, data_compra")
        .eq("cliente_id", clienteId)
        .order("data_compra", { ascending: false }),
      publicClient.from("gateway_products").select("*").eq("status", "active"),
      publicClient.from("clientes").select("produto").not("produto", "is", null).limit(100),
      supabase.from("client_followups").select("*").eq("cliente_id", clienteId).order("created_at", { ascending: false })
    ]);

    const cliente = clienteRes.data;
    if (!cliente) {
      return json({ error: "Cliente não encontrado" }, 404);
    }

    // Prepare available products list
    let availableProducts = productsRes.data || [];
    if (availableProducts.length === 0 && popularRes.data) {
      // Fallback: list of most common products in the DB
      const counts: Record<string, number> = {};
      popularRes.data.forEach(p => {
        counts[p.produto] = (counts[p.produto] || 0) + 1;
      });
      availableProducts = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([name]) => ({ name, status: 'active', description: 'Produto popular na base' }));
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
      produtos_disponiveis: availableProducts,
      historico_followups: followupsRes.data || [],
    };

    const systemPrompt = `Você é um especialista em vendas e customer success.
Sua tarefa é analisar o histórico de compras e o histórico de follow-ups (conversas e tentativas de contato) de um cliente, além dos produtos disponíveis na plataforma, para sugerir oportunidades de Upsell ou Cross-sell.

Upsell: Sugerir uma versão superior ou mais cara do produto que o cliente já possui.
Cross-sell: Sugerir produtos complementares ao que o cliente já possui.

Retorne APENAS um JSON válido no seguinte formato:
{
  "suggestions": [
    {
      "product_id": "uuid-ou-nome",
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

    // Save suggestions to database (optional, but we created the table so let's use it)
    try {
        await supabase.from("client_ai_upsell_suggestions").insert({
            cliente_id: clienteId,
            suggestions: parsedSuggestions,
            last_analysis_at: new Date().toISOString()
        });
    } catch (dbErr) {
        console.error("Error saving suggestions to DB:", dbErr);
    }

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
