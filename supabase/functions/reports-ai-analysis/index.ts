import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
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

    // Contexto fixo de negócio que SEMPRE deve ser enviado para a IA
    // independente de prompt customizado, para evitar interpretações erradas.
    const BUSINESS_CONTEXT = `
============================================================
📌 CONTEXTO DE NEGÓCIO (LEIA ANTES DE ANALISAR)
============================================================
SOBRE O CAMPO "plano":
- "Individual" NÃO é um tier de preço (não é Starter/Pro/Enterprise).
- "Individual" significa que o cliente NÃO possui plano de revendedor.
- Cliente "Individual" = compra ferramentas/produtos avulsos, cada um com seu preço próprio.
- Plano "Revendedor" = cliente que adquire um pacote de ferramentas para revender.
- Por isso é NORMAL e ESPERADO que clientes "Individual" tenham preços muito diferentes (de R$19 a R$450+): cada um adquiriu produtos/ferramentas distintos.
- NÃO sugira "padronizar tiers", "renomear Individual para Starter/Pro/Enterprise" nem trate a variação de preço dentro de "Individual" como problema de organização. Isso reflete a realidade do negócio.
- Se for analisar segmentação de receita, use PRODUTO + VALOR, não o campo "plano".

SOBRE CLIENTES "AGENDADO" (status_cliente = 'agendado'):
- É um serviço marcado que o cliente AINDA NÃO retirou/usou. Não é cliente ainda.
- NUNCA entra em receita, MRR, ARR, LTV, churn, receita em risco ou lucro. O valor dele é apenas PREVISÃO.
- Pode ter data de agendamento definida ou indefinida (sem dia marcado).
- Quando o cliente efetiva, ele é convertido para Mensal (recorrente) ou Registro (venda única) e o pagamento vai para aprovação.
- Por isso os dados abaixo já EXCLUEM os agendados. Não os trate como clientes perdidos, inadimplentes nem churn.

SOBRE OS TRÊS TIPOS FINANCEIROS:
- Mensal/Recorrente: possui ciclo mensal, bimestral, trimestral, semestral ou anual. Só entra no MRR quando a cobrança está ativa e a renovação está em dia, com tolerância de 7 dias.
- Registro/Venda Única: cobrança inativa e sem ciclo recorrente (sem ciclo ou vitalício). Entra em receita/vendas únicas, nunca em MRR, ARR, churn ou receita em risco.
- Agendado: somente previsão, nunca faturamento.
============================================================
`;

    // Build metrics message with at-risk clients
    let metricsMessage = `${BUSINESS_CONTEXT}\n\nDados do negócio para análise:\n\n${JSON.stringify(metricsData, null, 2)}`;


    // ============================================================
    // PRÉ-PROCESSAMENTO: Agrupar cadastros que pertencem ao mesmo cliente
    // Regra: agrupa SOMENTE quando CPF/CNPJ + e-mail + telefone forem
    // EXATAMENTE iguais (após normalização). Se algum dos 3 estiver vazio
    // em qualquer um dos cadastros, NÃO agrupa.
    // Não altera nada no banco — só enriquece o contexto enviado à IA.
    // ============================================================
    try {
      const { data: allClientesRaw } = await supabase
        .from("clientes")
        .select("id, nome, cpf, email, numero, produto, valor, moeda, ciclo_cobranca, data_renovacao, cobranca_ativa, plano, excluir_metricas, status_cliente");

      if (allClientesRaw && allClientesRaw.length > 0) {
        const allClientes = allClientesRaw.filter((c: any) => !c.excluir_metricas && c.status_cliente !== 'agendado');
        const normalizeDigits = (v: any) => (v ? String(v).replace(/\D/g, "").trim() : "");
        const normalizeEmail = (v: any) => (v ? String(v).toLowerCase().trim() : "");

        const groupsMap = new Map<string, any[]>();
        for (const c of allClientes) {
          const cpf = normalizeDigits(c.cpf);
          const email = normalizeEmail(c.email);
          const numero = normalizeDigits(c.numero);
          // Só considera para agrupamento se TODOS os 3 estiverem preenchidos
          if (!cpf || !email || !numero) continue;
          const key = `${cpf}|${email}|${numero}`;
          if (!groupsMap.has(key)) groupsMap.set(key, []);
          groupsMap.get(key)!.push(c);
        }

        // Filtra apenas grupos com 2+ cadastros (cliente único multi-produto)
        const CICLO_MESES: Record<string, number> = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
        const consolidatedGroups: any[] = [];
        for (const [, cadastros] of groupsMap) {
          if (cadastros.length < 2) continue;
          const principal = cadastros[0];
          const ciclosRecorrentes = new Set(["mensal", "bimestral", "trimestral", "semestral", "anual"]);
          const limiteMrr = new Date();
          limiteMrr.setDate(limiteMrr.getDate() - 7);
          limiteMrr.setHours(0, 0, 0, 0);
          const elegivelMrr = (c: any) => c.cobranca_ativa === true && ciclosRecorrentes.has(String(c.ciclo_cobranca || "").toLowerCase()) && new Date(`${c.data_renovacao}T12:00:00`) >= limiteMrr;
          const mrrConsolidado = cadastros
            .filter(elegivelMrr)
            .reduce((acc: number, c: any) => {
              const meses = CICLO_MESES[c.ciclo_cobranca] || 1;
              return acc + (Number(c.valor) || 0) / meses;
            }, 0);
          const valorTotalAtivo = cadastros
            .filter(elegivelMrr)
            .reduce((acc: number, c: any) => acc + (Number(c.valor) || 0), 0);

          consolidatedGroups.push({
            nome: principal.nome,
            cpf_cnpj: principal.cpf,
            email: principal.email,
            telefone: principal.numero,
            quantidade_cadastros: cadastros.length,
            mrr_consolidado: Number(mrrConsolidado.toFixed(2)),
            valor_total_ativo: Number(valorTotalAtivo.toFixed(2)),
            moeda_principal: principal.moeda || "BRL",
            produtos: cadastros.map((c: any) => ({
              produto: c.produto,
              valor: c.valor,
              moeda: c.moeda,
              ciclo_cobranca: c.ciclo_cobranca,
              data_renovacao: c.data_renovacao,
              plano: c.plano,
              cobranca_ativa: c.cobranca_ativa,
            })),
          });
        }

        if (consolidatedGroups.length > 0) {
          // Ordena por MRR consolidado decrescente
          consolidatedGroups.sort((a, b) => b.mrr_consolidado - a.mrr_consolidado);

          metricsMessage += `

============================================================
🔗 CLIENTES AGRUPADOS (mesmo CPF/CNPJ + e-mail + telefone)
============================================================
Os cadastros abaixo foram pré-agrupados automaticamente porque possuem
EXATAMENTE o mesmo CPF/CNPJ, e-mail e telefone. Trate cada grupo como
UM ÚNICO CLIENTE com múltiplos produtos/assinaturas — NÃO sugira
deduplicação ou "problema de organização" para esses casos. Eles são
compras legítimas em datas diferentes do mesmo cliente.

Use o "mrr_consolidado" para análises de risco, prioridade e LTV real.
Quando se referir ao cliente nas recomendações, use o nome consolidado
e mencione os produtos juntos (ex: "Ruberlanio — 3 produtos ativos,
MRR R$ 1.184").

Total de clientes consolidados detectados: ${consolidatedGroups.length}

${JSON.stringify(consolidatedGroups, null, 2)}
============================================================`;

          console.log(`[reports-ai] Pré-processamento: ${consolidatedGroups.length} clientes consolidados detectados`);
        }
      }
    } catch (groupErr: any) {
      // Não bloqueia a análise se o agrupamento falhar
      console.error("[reports-ai] Erro no pré-processamento de agrupamento:", groupErr.message);
    }

    // If scheduled, fetch fresh data
    if (scheduled) {
      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, nome, data_renovacao, valor, moeda, ciclo_cobranca, plano, excluir_metricas, status_cliente")
        .eq("cobranca_ativa", true)
        .in("ciclo_cobranca", ["mensal", "bimestral", "trimestral", "semestral", "anual"])
        .or("status_cliente.is.null,status_cliente.neq.agendado");

      if (clientes) {
        const recurringClientes = clientes.filter((c: any) => !c.excluir_metricas);
        const mrrLimit = new Date();
        mrrLimit.setDate(mrrLimit.getDate() - 7);
        mrrLimit.setHours(0, 0, 0, 0);
        const activeClientes = recurringClientes.filter((c: any) => new Date(`${c.data_renovacao}T12:00:00`) >= mrrLimit);
        const now = new Date();
        const atRisk = recurringClientes.filter((c: any) => {
          const renovacao = new Date(c.data_renovacao);
          const daysUntil = Math.ceil((renovacao.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return daysUntil <= 15 && daysUntil >= -30;
        });

        const CICLO_MESES: Record<string, number> = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
        const mrrBRL = activeClientes
          .filter((c: any) => (c.moeda || "BRL") === "BRL")
          .reduce((acc: number, c: any) => acc + c.valor / (CICLO_MESES[c.ciclo_cobranca] || 1), 0);
        const mrrUSD = activeClientes
          .filter((c: any) => c.moeda === "USD")
          .reduce((acc: number, c: any) => acc + c.valor / (CICLO_MESES[c.ciclo_cobranca] || 1), 0);

        metricsMessage = `${BUSINESS_CONTEXT}

Dados do negócio para análise:

MRR BRL: R$ ${mrrBRL.toFixed(2)}
MRR USD: $ ${mrrUSD.toFixed(2)}
Total de clientes ativos: ${activeClientes.length}

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
      const { notifyWhatsapp, notifyEmail, whatsappNumbers, emailAddresses, gmailUser, gmailPass, gmailSenderName, origin } = payload;
      await sendScheduledNotifications(supabase, responseText, {
        notifyWhatsapp,
        notifyEmail,
        whatsappNumbers,
        emailAddresses,
        gmailUser,
        gmailPass,
        gmailSenderName,
        origin,
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
      const gmailUser = overrides?.gmailUser || configRow?.gmail_user || Deno.env.get("GMAIL_USER") || "";
      const gmailPass = overrides?.gmailPass || configRow?.gmail_app_password || Deno.env.get("GMAIL_APP_PASSWORD") || "";
      const gmailSenderName = overrides?.gmailSenderName || configRow?.gmail_sender_name || "";

      if (gmailUser && gmailPass) {
        const dateStr = new Date().toLocaleDateString("pt-BR");
        const dashboardUrl = overrides?.origin ? `${overrides.origin}/admin/relatorios` : '';
        const analysisHtml = analysis
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/### (.*?)\n/g, '<h3>$1</h3>')
          .replace(/## (.*?)\n/g, '<h2>$1</h2>')
          .replace(/# (.*?)\n/g, '<h1>$1</h1>')
          .replace(/\n/g, '<br>');

        const buttonBlock = dashboardUrl
          ? `<div style="text-align:center;margin-top:30px;"><a href="${dashboardUrl}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Ver Dashboard Completo</a></div>`
          : '';

        // Build as a single line to avoid quoted-printable soft line break artifacts (=20, =\n)
        const rawHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Relatório de IA</title></head><body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#1a1a1a;margin:0;padding:0;background-color:#f4f7fa;"><div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.05);"><div style="background:linear-gradient(135deg,#0ea5e9 0%,#2563eb 100%);padding:40px 20px;text-align:center;color:#ffffff;"><div style="display:inline-block;padding:4px 12px;border-radius:20px;background:rgba(255,255,255,0.2);font-size:12px;font-weight:600;margin-bottom:15px;">Relatório Automatizado</div><h1 style="margin:0;font-size:28px;font-weight:700;letter-spacing:-0.5px;color:#ffffff;">Análise de Métricas IA</h1><p style="margin:10px 0 0;opacity:0.9;font-size:16px;color:#ffffff;">Dashboard de Performance • ${dateStr}</p></div><div style="padding:40px;"><div style="font-size:16px;color:#374151;">${analysisHtml}</div>${buttonBlock}<hr style="border:0;border-top:1px solid #e2e8f0;margin:30px 0;"><p style="font-size:14px;color:#64748b;text-align:center;">Esta análise foi gerada por inteligência artificial com base nas métricas reais do seu sistema.</p></div><div style="padding:20px;background:#f9fafb;border-top:1px solid #edf2f7;text-align:center;font-size:12px;color:#94a3b8;">&copy; ${new Date().getFullYear()} Sistema de Gestão. Todos os direitos reservados.</div></div></body></html>`;

        // Remove trailing whitespace on any line and collapse to prevent =20 artifacts
        const htmlContent = rawHtml.replace(/[ \t]+$/gm, '').replace(/\s+\n/g, '\n');

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
                subject: `Relatório de IA - Análise Automática - ${dateStr}`,
                content: "Visualize este e-mail em um cliente compatível com HTML para ver o relatório formatado.",
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
