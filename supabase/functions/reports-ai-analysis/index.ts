import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

    const payload = await req.json();
    const { provider, model, customPrompt, metricsData, openaiApiKey, grokApiKey, scheduled } = payload;

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
    const { data: historyData, error: historyError } = await supabase.from("reports_analysis_history").insert({
      analysis_text: responseText,
      ai_provider: aiProvider,
      ai_model: requestBody.model,
      prompt_used: promptToUse,
      metrics_snapshot: metricsData || {},
    }).select("id").single();

    if (historyError) {
      console.error("[reports-ai] History save error:", historyError);
    }

    const analysisId = historyData?.id;

    // If scheduled or specifically requested, send notifications and log them
    if (scheduled) {
      const { notifyWhatsapp, notifyEmail, whatsappNumbers, emailAddresses, gmailUser, gmailPass, gmailSenderName } = payload;
      await sendScheduledNotifications(supabase, responseText, {
        notifyWhatsapp,
        notifyEmail,
        whatsappNumbers,
        emailAddresses,
        gmailUser,
        gmailPass,
        gmailSenderName,
        analysisId
      });
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

async function sendScheduledNotifications(supabase: any, analysis: string, overrides?: any) {
  try {
    let notifyWhatsapp, notifyEmail, whatsappNumbers, emailAddresses;

    const { data: configRow } = await supabase
      .from("reports_analysis_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (overrides?.notifyWhatsapp !== undefined || overrides?.notifyEmail !== undefined) {
      notifyWhatsapp = overrides.notifyWhatsapp;
      notifyEmail = overrides.notifyEmail;
      whatsappNumbers = overrides.whatsappNumbers || [];
      emailAddresses = overrides.emailAddresses || [];
    } else {
      if (!configRow) {
        console.warn("[reports-ai] No reports_analysis_config found, skipping notifications");
        return;
      }
      
      notifyWhatsapp = configRow.notify_whatsapp;
      notifyEmail = configRow.notify_email;
      whatsappNumbers = configRow.whatsapp_recipients || [];
      emailAddresses = configRow.email_recipients || [];
    }

    console.log(`[reports-ai] Notification config: whatsapp=${notifyWhatsapp} (${whatsappNumbers.length} numbers), email=${notifyEmail} (${emailAddresses.length} emails)`);


    // WhatsApp notifications
    if (notifyWhatsapp && whatsappNumbers.length > 0) {
      // Try billing instances first, then calendar instances as fallback
      let instance: any = null;

      const { data: billingInstances } = await supabase
        .from("billing_whatsapp_instances")
        .select("*")
        .eq("is_active", true)
        .limit(1);

      if (billingInstances?.length) {
        instance = billingInstances[0];
      } else {
        // Fallback to calendar notification instances
        const { data: calendarInstances } = await supabase
          .from("calendar_notification_whatsapp_instances")
          .select("*")
          .eq("is_active", true)
          .limit(1);
        if (calendarInstances?.length) {
          instance = calendarInstances[0];
        }
      }

      if (!instance) {
        // Last resort: use project secrets
        const apiUrl = Deno.env.get("EVOLUTION_API_URL");
        const apiKey = Deno.env.get("EVOLUTION_API_KEY");
        const instanceName = Deno.env.get("EVOLUTION_INSTANCE");
        if (apiUrl && apiKey && instanceName) {
          instance = { api_url: apiUrl, api_key: apiKey, instance_name: instanceName };
        }
      }

      if (instance) {
        const shortAnalysis = analysis.length > 3000 ? analysis.substring(0, 3000) + "..." : analysis;
        const message = `📊 *Relatório de IA - Análise Automática*\n\n${shortAnalysis}`;

        for (const number of whatsappNumbers) {
          try {
            const phone = number.replace(/\D/g, "");
            if (!phone) continue;

            const sendRes = await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: instance.api_key },
              body: JSON.stringify({ number: phone, text: message }),
            });

            const sendStatus = sendRes.ok ? "sent" : "error";
            const sendBody = await sendRes.text().catch(() => "");

            // Log the send attempt
            await supabase.from("reports_notification_logs").insert({
              channel: "whatsapp",
              recipient: phone,
              status: sendStatus,
              error_message: sendStatus === "error" ? sendBody.substring(0, 500) : null,
              analysis_id: overrides?.analysisId,
            }).then(() => {}).catch(() => {});

            console.log(`[reports-ai] WhatsApp to ${phone}: ${sendStatus}`);
          } catch (e: any) {
            console.error(`[reports-ai] WhatsApp error for ${number}:`, e.message);
            await supabase.from("reports_notification_logs").insert({
              channel: "whatsapp",
              recipient: number,
              status: "error",
              error_message: e.message?.substring(0, 500),
              analysis_id: overrides?.analysisId,
            }).then(() => {}).catch(() => {});
          }
        }
      } else {
        console.error("[reports-ai] No WhatsApp instance available for sending");
      }
    }

    // Email notifications via Gmail SMTP
    if (notifyEmail && emailAddresses.length > 0) {
      // Use config credentials if available, otherwise fallback to environment variables
      const gmailUser = configRow?.gmail_user || Deno.env.get("GMAIL_USER") || "";
      const gmailPass = configRow?.gmail_app_password || Deno.env.get("GMAIL_APP_PASSWORD") || "";
      const gmailSenderName = configRow?.gmail_sender_name || "";

      if (gmailUser && gmailPass) {
        const dateStr = new Date().toLocaleDateString("pt-BR");
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de IA</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f4f7fa; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); padding: 40px 20px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 10px 0 0; opacity: 0.9; font-size: 16px; }
    .content { padding: 40px; }
    .analysis { font-size: 16px; color: #374151; }
    .analysis h1, .analysis h2, .analysis h3 { color: #111827; margin-top: 24px; }
    .analysis strong { color: #1d4ed8; }
    .footer { padding: 20px; background: #f9fafb; border-top: 1px solid #edf2f7; text-align: center; font-size: 12px; color: #94a3b8; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; background: rgba(255,255,255,0.2); font-size: 12px; font-weight: 600; margin-bottom: 15px; }
    hr { border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">Relatório Automatizado</div>
      <h1>Análise de Métricas IA</h1>
      <p>Dashboard de Performance • ${dateStr}</p>
    </div>
    <div class="content">
      <div class="analysis">
        ${analysis
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/### (.*?)\n/g, '<h3>$1</h3>')
          .replace(/## (.*?)\n/g, '<h2>$1</h2>')
          .replace(/# (.*?)\n/g, '<h1>$1</h1>')
          .replace(/\n/g, '<br>')}
      </div>
      <hr>
      <p style="font-size: 14px; color: #64748b; text-align: center;">
        Esta análise foi gerada por inteligência artificial com base nas métricas reais do seu sistema.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Sistema de Gestão. Todos os direitos reservados.
    </div>
  </div>
</body>
</html>`;

        let smtpClient: SMTPClient | null = null;
        try {
          smtpClient = new SMTPClient({
            connection: {
              hostname: "smtp.gmail.com",
              port: 465,
              tls: true,
              auth: { username: gmailUser, password: gmailPass },
            },
          });

          for (const email of emailAddresses) {
            try {
              await smtpClient.send({
                from: gmailSenderName ? `${gmailSenderName} <${gmailUser}>` : gmailUser,
                to: email,
                subject: `📊 Relatório de IA - Análise Automática - ${dateStr}`,
                html: htmlContent,
              });

              await supabase.from("reports_notification_logs").insert({
                channel: "email",
                recipient: email,
                status: "sent",
                analysis_id: overrides?.analysisId,
              }).then(() => {}).catch(() => {});

              console.log(`[reports-ai] Email sent to ${email}`);
            } catch (e: any) {
              console.error(`[reports-ai] Email error for ${email}:`, e.message);
              await supabase.from("reports_notification_logs").insert({
                channel: "email",
                recipient: email,
                status: "error",
                error_message: e.message?.substring(0, 500),
                analysis_id: overrides?.analysisId,
              }).then(() => {}).catch(() => {});
            }
          }
          await smtpClient.close();
        } catch (smtpErr: any) {
          console.error(`[reports-ai] SMTP connection error:`, smtpErr.message);
          // Log for all emails
          for (const email of emailAddresses) {
            await supabase.from("reports_notification_logs").insert({
              channel: "email",
              recipient: email,
              status: "error",
              error_message: `SMTP connection failed: ${smtpErr.message?.substring(0, 400)}`,
              analysis_id: overrides?.analysisId,
            }).then(() => {}).catch(() => {});
          }
        }
      } else {
        console.warn("[reports-ai] GMAIL_USER or GMAIL_APP_PASSWORD not configured for email notifications");
      }
    }

    // Update last_analysis_at if it's a scheduled run
    if (!overrides) {
      const { data: configRow } = await supabase.from("reports_analysis_config").select("id").limit(1).maybeSingle();
      if (configRow) {
        await supabase.from("reports_analysis_config").update({
          last_analysis_at: new Date().toISOString(),
        }).eq("id", configRow.id);
      }
    }

  } catch (e: any) {
    console.error("[reports-ai] Notification error:", e.message);
  }
}
