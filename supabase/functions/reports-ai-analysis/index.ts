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
    await supabase.from("reports_analysis_history").insert({
      analysis_text: responseText,
      ai_provider: aiProvider,
      ai_model: requestBody.model,
      prompt_used: promptToUse,
      metrics_snapshot: metricsData || {},
    });

    // If scheduled or specifically requested, send notifications and log them
    if (scheduled) {
      const { notifyWhatsapp, notifyEmail, whatsappNumbers, emailAddresses } = payload;
      await sendScheduledNotifications(supabase, responseText, {
        notifyWhatsapp,
        notifyEmail,
        whatsappNumbers,
        emailAddresses
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

    if (overrides?.notifyWhatsapp !== undefined || overrides?.notifyEmail !== undefined) {
      notifyWhatsapp = overrides.notifyWhatsapp;
      notifyEmail = overrides.notifyEmail;
      whatsappNumbers = overrides.whatsappNumbers || [];
      emailAddresses = overrides.emailAddresses || [];
    } else {
      const { data: configRow } = await supabase
        .from("reports_analysis_config")
        .select("*")
        .limit(1)
        .maybeSingle();
        
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
            }).then(() => {}).catch(() => {});

            console.log(`[reports-ai] WhatsApp to ${phone}: ${sendStatus}`);
          } catch (e: any) {
            console.error(`[reports-ai] WhatsApp error for ${number}:`, e.message);
            await supabase.from("reports_notification_logs").insert({
              channel: "whatsapp",
              recipient: number,
              status: "error",
              error_message: e.message?.substring(0, 500),
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
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:25px;border-radius:10px 10px 0 0;text-align:center;">
    <h1 style="color:white;margin:0;">📊 Relatório de IA</h1>
    <p style="color:rgba(255,255,255,0.8);margin:5px 0 0;">Análise Automática de Métricas - ${dateStr}</p>
  </div>
  <div style="background:#f9fafb;padding:25px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <div style="white-space:pre-wrap;font-size:14px;color:#374151;line-height:1.6;">${analysis.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="font-size:11px;color:#9ca3af;text-align:center;">Gerado automaticamente pelo sistema</p>
  </div>
</body></html>`;

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
              }).then(() => {}).catch(() => {});

              console.log(`[reports-ai] Email sent to ${email}`);
            } catch (e: any) {
              console.error(`[reports-ai] Email error for ${email}:`, e.message);
              await supabase.from("reports_notification_logs").insert({
                channel: "email",
                recipient: email,
                status: "error",
                error_message: e.message?.substring(0, 500),
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
