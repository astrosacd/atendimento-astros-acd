import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PROMPT = `Você é um analista de negócios especializado em SaaS e gestão de clientes. Analise os dados abaixo e forneça:

1. **Resumo da Situação Atual** - Uma visão geral do estado do negócio
2. **Pontos de Atenção** - Problemas ou riscos identificados
3. **Clientes em Risco** - Liste clientes com renovação próxima ou atrasada e sugira ações específicas para cada um
4. **Recomendações Práticas** - Ações específicas para melhorar as métricas (reduzir churn, aumentar MRR, melhorar LTV)
5. **Oportunidades** - Sugestões de crescimento e retenção

Seja direto, prático e use bullet points. Foque em ações que podem ser tomadas imediatamente.
Se houver clientes em risco, detalhe cada um com nome, data de renovação e sugestão de abordagem.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { provider, model, customPrompt, metricsData, openaiApiKey, grokApiKey, scheduled } = await req.json();

    const aiProvider = provider || "lovable";
    const aiModel = model || "google/gemini-3-flash-preview";
    const promptToUse = customPrompt || DEFAULT_PROMPT;

    // Build metrics message with at-risk clients
    let metricsMessage = `Dados do negócio para análise:\n\n${JSON.stringify(metricsData, null, 2)}`;

    // If scheduled, fetch fresh data
    if (scheduled) {
      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, nome, data_renovacao, valor, moeda, ciclo_cobranca, plano")
        .eq("cobranca_ativa", true);

      if (clientes) {
        const now = new Date();
        const atRisk = clientes.filter((c: any) => {
          const renovacao = new Date(c.data_renovacao);
          const daysUntil = Math.ceil((renovacao.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return daysUntil <= 15 && daysUntil >= -30;
        });

        const CICLO_MESES: Record<string, number> = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
        const mrrBRL = clientes
          .filter((c: any) => (c.moeda || "BRL") === "BRL")
          .reduce((acc: number, c: any) => acc + c.valor / (CICLO_MESES[c.ciclo_cobranca] || 1), 0);
        const mrrUSD = clientes
          .filter((c: any) => c.moeda === "USD")
          .reduce((acc: number, c: any) => acc + c.valor / (CICLO_MESES[c.ciclo_cobranca] || 1), 0);

        metricsMessage = `Dados do negócio para análise:

MRR BRL: R$ ${mrrBRL.toFixed(2)}
MRR USD: $ ${mrrUSD.toFixed(2)}
Total de clientes ativos: ${clientes.length}

Clientes em risco (renovação próxima ou atrasada):
${atRisk.map((c: any) => `- ${c.nome}: renovação ${c.data_renovacao}, valor ${c.moeda || "BRL"} ${c.valor}, plano: ${c.plano || "N/A"}`).join("\n")}`;
      }
    }

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
    const responseText = aiData.choices?.[0]?.message?.content || "Sem resposta da IA";

    // Save to history
    await supabase.from("reports_analysis_history").insert({
      analysis_text: responseText,
      ai_provider: aiProvider,
      ai_model: requestBody.model,
      prompt_used: promptToUse,
      metrics_snapshot: metricsData || {},
    });

    // If scheduled, send notifications
    if (scheduled) {
      await sendScheduledNotifications(supabase, responseText);
    }

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

async function sendScheduledNotifications(supabase: any, analysis: string) {
  try {
    const { data: configRow } = await supabase
      .from("reports_analysis_config")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (!configRow) return;

    const notifyWhatsapp = configRow.notify_whatsapp;
    const notifyEmail = configRow.notify_email;
    const whatsappNumbers: string[] = configRow.whatsapp_recipients || [];
    const emailAddresses: string[] = configRow.email_recipients || [];

    // WhatsApp notifications
    if (notifyWhatsapp && whatsappNumbers.length > 0) {
      const { data: instances } = await supabase
        .from("billing_whatsapp_instances")
        .select("*")
        .eq("is_active", true)
        .limit(1);

      if (instances?.length) {
        const instance = instances[0];
        const shortAnalysis = analysis.length > 3000 ? analysis.substring(0, 3000) + "..." : analysis;
        const message = `📊 *Relatório de IA - Análise Automática*\n\n${shortAnalysis}`;

        for (const number of whatsappNumbers) {
          try {
            const phone = number.replace(/\D/g, "");
            await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: instance.api_key },
              body: JSON.stringify({ number: phone, text: message }),
            });
            console.log(`[reports-ai] WhatsApp sent to ${phone}`);
          } catch (e: any) {
            console.error(`[reports-ai] WhatsApp error:`, e.message);
          }
        }
      }
    }

    // Email notifications via Gmail SMTP
    if (notifyEmail && emailAddresses.length > 0) {
      const gmailUser = configMap.gmail_user || "";
      const gmailPass = configMap.gmail_password || "";

      if (gmailUser && gmailPass) {
        const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
        
        const htmlContent = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:25px;border-radius:10px 10px 0 0;text-align:center;">
    <h1 style="color:white;margin:0;">📊 Relatório de IA</h1>
    <p style="color:rgba(255,255,255,0.8);margin:5px 0 0;">Análise Automática de Métricas</p>
  </div>
  <div style="background:#f9fafb;padding:25px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <div style="white-space:pre-wrap;font-size:14px;color:#374151;line-height:1.6;">${analysis.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="font-size:11px;color:#9ca3af;text-align:center;">Gerado automaticamente pelo sistema</p>
  </div>
</body></html>`;

        const smtpClient = new SMTPClient({
          connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: gmailUser, password: gmailPass } },
        });

        for (const email of emailAddresses) {
          try {
            await smtpClient.send({
              from: gmailUser,
              to: email,
              subject: `📊 Relatório de IA - Análise Automática - ${new Date().toLocaleDateString("pt-BR")}`,
              html: htmlContent,
            });
            console.log(`[reports-ai] Email sent to ${email}`);
          } catch (e: any) {
            console.error(`[reports-ai] Email error:`, e.message);
          }
        }
        await smtpClient.close();
      }
    }
  } catch (e: any) {
    console.error("[reports-ai] Notification error:", e.message);
  }
}
