import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RenewalItem {
  cliente_id: string | null;
  nome: string;
  produto: string | null;
  plano: string | null;
  valor: number | null;
  moeda: string | null;
  data_anterior: string | null;
  data_nova: string | null;
}

interface PaymentItem {
  cliente_id: string | null;
  nome: string;
  produto: string | null;
  amount: number;
  moeda: string;
  payment_type: string;
  paid_at: string;
}

function fmtCurrency(value: number, moeda: string = "BRL") {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(value);
  } catch {
    return `${moeda} ${value.toFixed(2)}`;
  }
}

function fmtDate(d: string | null) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

async function fetchWeekData(supabase: any, weekStart: Date, weekEnd: Date) {
  // (i) Renovações reais — client_history com changed_fields contendo 'data_renovacao'
  const { data: histRows } = await supabase
    .from("client_history")
    .select("cliente_id, previous_data, new_data, changed_fields, created_at")
    .gte("created_at", weekStart.toISOString())
    .lte("created_at", weekEnd.toISOString())
    .contains("changed_fields", ["data_renovacao"]);

  const renewals: RenewalItem[] = [];
  if (histRows && histRows.length > 0) {
    const ids = Array.from(new Set(histRows.map((r: any) => r.cliente_id).filter(Boolean)));
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nome, produto, plano, valor, moeda")
      .in("id", ids);
    const clienteMap = new Map<string, any>((clientes || []).map((c: any) => [c.id, c]));

    for (const row of histRows) {
      const c = row.cliente_id ? clienteMap.get(row.cliente_id) : null;
      if (!c) continue;
      const prev = row.previous_data || {};
      const nxt = row.new_data || {};
      const dataAnterior = prev?.data_renovacao || null;
      const dataNova = nxt?.data_renovacao || null;
      // só conta se realmente mudou
      if (dataAnterior === dataNova) continue;
      renewals.push({
        cliente_id: row.cliente_id,
        nome: c.nome,
        produto: c.produto,
        plano: c.plano,
        valor: nxt?.valor ?? c.valor,
        moeda: nxt?.moeda ?? c.moeda ?? "BRL",
        data_anterior: dataAnterior,
        data_nova: dataNova,
      });
    }
  }

  // (ii) Pagamentos efetivados — client_payments.paid_at na janela
  const { data: payRows } = await supabase
    .from("client_payments")
    .select("cliente_id, amount, payment_type, paid_at, status")
    .gte("paid_at", weekStart.toISOString())
    .lte("paid_at", weekEnd.toISOString())
    .not("paid_at", "is", null);

  const payments: PaymentItem[] = [];
  if (payRows && payRows.length > 0) {
    const ids = Array.from(new Set(payRows.map((p: any) => p.cliente_id).filter(Boolean)));
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nome, produto, moeda")
      .in("id", ids);
    const clienteMap = new Map<string, any>((clientes || []).map((c: any) => [c.id, c]));

    for (const p of payRows) {
      if (!["paid", "approved", "success", "completed"].includes((p.status || "").toLowerCase()) && p.status) {
        // Aceita também sem status conhecido se paid_at existe
      }
      const c = p.cliente_id ? clienteMap.get(p.cliente_id) : null;
      payments.push({
        cliente_id: p.cliente_id,
        nome: c?.nome || "Cliente desconhecido",
        produto: c?.produto || null,
        amount: Number(p.amount) || 0,
        moeda: c?.moeda || "BRL",
        payment_type: p.payment_type || "-",
        paid_at: p.paid_at,
      });
    }
  }

  return { renewals, payments };
}

function buildTotals(renewals: RenewalItem[], payments: PaymentItem[]) {
  const renewalsBRL = renewals.filter((r) => (r.moeda || "BRL") === "BRL").reduce((a, r) => a + (Number(r.valor) || 0), 0);
  const renewalsUSD = renewals.filter((r) => r.moeda === "USD").reduce((a, r) => a + (Number(r.valor) || 0), 0);
  const paymentsBRL = payments.filter((p) => (p.moeda || "BRL") === "BRL").reduce((a, p) => a + p.amount, 0);
  const paymentsUSD = payments.filter((p) => p.moeda === "USD").reduce((a, p) => a + p.amount, 0);
  return {
    renewalsBRL,
    renewalsUSD,
    paymentsBRL,
    paymentsUSD,
    totalBRL: renewalsBRL + paymentsBRL,
    totalUSD: renewalsUSD + paymentsUSD,
  };
}

function pctChange(current: number, prev: number): string {
  if (prev === 0 && current === 0) return "—";
  if (prev === 0) return "+100%";
  const diff = ((current - prev) / prev) * 100;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(0)}%`;
}

function buildTextReport(opts: {
  weekStart: Date;
  weekEnd: Date;
  current: { renewals: RenewalItem[]; payments: PaymentItem[] };
  previous: { renewals: RenewalItem[]; payments: PaymentItem[] };
  includeRenewals: boolean;
  includePayments: boolean;
}): string {
  const { weekStart, weekEnd, current, previous, includeRenewals, includePayments } = opts;
  const totals = buildTotals(current.renewals, current.payments);
  const totalsPrev = buildTotals(previous.renewals, previous.payments);

  const lines: string[] = [];
  lines.push(`📊 *Relatório Semanal de Clientes*`);
  lines.push(`Semana: ${fmtDate(weekStart.toISOString())} a ${fmtDate(weekEnd.toISOString())}`);
  lines.push("");

  // Comparativo no topo
  const currentCount = current.renewals.length + current.payments.length;
  const previousCount = previous.renewals.length + previous.payments.length;
  lines.push(`*Comparativo com a semana anterior:*`);
  lines.push(`• Total de eventos: ${currentCount} (anterior: ${previousCount}, ${pctChange(currentCount, previousCount)})`);
  lines.push(`• Valor BRL: ${fmtCurrency(totals.totalBRL, "BRL")} (anterior: ${fmtCurrency(totalsPrev.totalBRL, "BRL")}, ${pctChange(totals.totalBRL, totalsPrev.totalBRL)})`);
  if (totals.totalUSD > 0 || totalsPrev.totalUSD > 0) {
    lines.push(`• Valor USD: ${fmtCurrency(totals.totalUSD, "USD")} (anterior: ${fmtCurrency(totalsPrev.totalUSD, "USD")}, ${pctChange(totals.totalUSD, totalsPrev.totalUSD)})`);
  }
  lines.push("");

  if (includeRenewals) {
    lines.push(`━━━━━━━━━━━━━━━━━━━`);
    lines.push(`*🔄 Renovações de Clientes (${current.renewals.length})*`);
    lines.push(`Total BRL: ${fmtCurrency(totals.renewalsBRL, "BRL")}${totals.renewalsUSD > 0 ? ` | USD: ${fmtCurrency(totals.renewalsUSD, "USD")}` : ""}`);
    lines.push("");
    if (current.renewals.length === 0) {
      lines.push(`_Nenhuma renovação registrada nesta semana._`);
    } else {
      for (const r of current.renewals) {
        lines.push(`• *${r.nome}*`);
        lines.push(`   Produto: ${r.produto || "-"}${r.plano ? ` (${r.plano})` : ""}`);
        lines.push(`   Valor: ${fmtCurrency(Number(r.valor) || 0, r.moeda || "BRL")}`);
        lines.push(`   Data anterior: ${fmtDate(r.data_anterior)} → Nova data: ${fmtDate(r.data_nova)}`);
        lines.push("");
      }
    }
  }

  if (includePayments) {
    lines.push(`━━━━━━━━━━━━━━━━━━━`);
    lines.push(`*💰 Pagamentos Efetivados (${current.payments.length})*`);
    lines.push(`Total BRL: ${fmtCurrency(totals.paymentsBRL, "BRL")}${totals.paymentsUSD > 0 ? ` | USD: ${fmtCurrency(totals.paymentsUSD, "USD")}` : ""}`);
    lines.push("");
    if (current.payments.length === 0) {
      lines.push(`_Nenhum pagamento efetivado nesta semana._`);
    } else {
      for (const p of current.payments) {
        lines.push(`• *${p.nome}*`);
        lines.push(`   Produto: ${p.produto || "-"}`);
        lines.push(`   Valor: ${fmtCurrency(p.amount, p.moeda || "BRL")} (${p.payment_type})`);
        lines.push(`   Pago em: ${fmtDate(p.paid_at)}`);
        lines.push("");
      }
    }
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━`);
  lines.push(`_Gerado automaticamente — ${new Date().toLocaleString("pt-BR")}_`);
  return lines.join("\n");
}

function buildHtmlReport(textReport: string): string {
  const html = textReport
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .replace(/━+/g, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>')
    .replace(/\n/g, "<br/>");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#111827;line-height:1.6">${html}</div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { scheduled, test, overrides } = body || {};

    // Carrega config
    const { data: config } = await supabase
      .from("weekly_renewals_report_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (scheduled && !config?.is_active) {
      return new Response(JSON.stringify({ skipped: true, reason: "inactive" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const effective = {
      notify_whatsapp: overrides?.notify_whatsapp ?? config?.notify_whatsapp ?? false,
      notify_email: overrides?.notify_email ?? config?.notify_email ?? false,
      whatsapp_recipients: overrides?.whatsapp_recipients ?? config?.whatsapp_recipients ?? [],
      email_recipients: overrides?.email_recipients ?? config?.email_recipients ?? [],
      whatsapp_instance_id: overrides?.whatsapp_instance_id ?? config?.whatsapp_instance_id ?? null,
      gmail_user: overrides?.gmail_user ?? config?.gmail_user,
      gmail_app_password: overrides?.gmail_app_password ?? config?.gmail_app_password,
      gmail_sender_name: overrides?.gmail_sender_name ?? config?.gmail_sender_name,
      send_when_empty: overrides?.send_when_empty ?? config?.send_when_empty ?? true,
      include_renewals: overrides?.include_renewals ?? config?.include_renewals ?? true,
      include_payments: overrides?.include_payments ?? config?.include_payments ?? true,
    };

    // Janela: semana atual = últimos 7 dias até agora
    const now = new Date();
    const weekEnd = new Date(now);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const prevEnd = new Date(weekStart);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 7);

    const current = await fetchWeekData(supabase, weekStart, weekEnd);
    const previous = await fetchWeekData(supabase, prevStart, prevEnd);

    const currentCount = current.renewals.length + current.payments.length;
    if (currentCount === 0 && !effective.send_when_empty && !test) {
      return new Response(JSON.stringify({ skipped: true, reason: "empty_week" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const textReport = buildTextReport({
      weekStart,
      weekEnd,
      current,
      previous,
      includeRenewals: effective.include_renewals,
      includePayments: effective.include_payments,
    });
    const htmlReport = buildHtmlReport(textReport);
    const totals = buildTotals(current.renewals, current.payments);

    const results: any[] = [];

    // === WhatsApp ===
    if (effective.notify_whatsapp && effective.whatsapp_recipients.length > 0) {
      let instance: any = null;
      if (effective.whatsapp_instance_id) {
        const { data } = await supabase
          .from("billing_whatsapp_instances")
          .select("*")
          .eq("id", effective.whatsapp_instance_id)
          .eq("is_active", true)
          .maybeSingle();
        instance = data;
      }
      if (!instance) {
        const { data } = await supabase
          .from("billing_whatsapp_instances")
          .select("*")
          .eq("is_active", true)
          .limit(1);
        if (data?.length) instance = data[0];
      }
      if (!instance) {
        const { data } = await supabase
          .from("calendar_notification_whatsapp_instances")
          .select("*")
          .eq("is_active", true)
          .limit(1);
        if (data?.length) instance = data[0];
      }
      if (!instance) {
        const apiUrl = Deno.env.get("EVOLUTION_API_URL");
        const apiKey = Deno.env.get("EVOLUTION_API_KEY");
        const instanceName = Deno.env.get("EVOLUTION_INSTANCE");
        if (apiUrl && apiKey && instanceName) {
          instance = { api_url: apiUrl, api_key: apiKey, instance_name: instanceName };
        }
      }

      if (instance) {
        for (const num of effective.whatsapp_recipients) {
          const phone = String(num).replace(/\D/g, "");
          if (!phone) continue;
          try {
            const res = await fetch(`${instance.api_url}/message/sendText/${instance.instance_name}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: instance.api_key },
              body: JSON.stringify({ number: phone, text: textReport }),
            });
            const ok = res.ok;
            const bodyTxt = await res.text().catch(() => "");
            await supabase.from("weekly_renewals_report_logs").insert({
              channel: "whatsapp",
              recipient: phone,
              status: ok ? "sent" : "error",
              error_message: ok ? null : bodyTxt.substring(0, 500),
              total_renewals: current.renewals.length,
              total_payments: current.payments.length,
              total_amount_brl: totals.totalBRL,
              total_amount_usd: totals.totalUSD,
              is_test: !!test,
            });
            results.push({ channel: "whatsapp", recipient: phone, status: ok ? "sent" : "error" });
          } catch (e: any) {
            await supabase.from("weekly_renewals_report_logs").insert({
              channel: "whatsapp",
              recipient: phone,
              status: "error",
              error_message: e.message?.substring(0, 500),
              total_renewals: current.renewals.length,
              total_payments: current.payments.length,
              total_amount_brl: totals.totalBRL,
              total_amount_usd: totals.totalUSD,
              is_test: !!test,
            });
            results.push({ channel: "whatsapp", recipient: phone, status: "error", error: e.message });
          }
        }
      } else {
        results.push({ channel: "whatsapp", status: "error", error: "Nenhuma instância WhatsApp disponível" });
      }
    }

    // === Email ===
    if (effective.notify_email && effective.email_recipients.length > 0) {
      const gmailUser = effective.gmail_user || Deno.env.get("GMAIL_USER") || "";
      const gmailPass = effective.gmail_app_password || Deno.env.get("GMAIL_APP_PASSWORD") || "";
      const senderName = effective.gmail_sender_name || "Relatório Semanal";

      if (gmailUser && gmailPass) {
        const client = new SMTPClient({
          connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: gmailUser, password: gmailPass } },
        });
        const subject = `📊 Relatório Semanal de Clientes — ${fmtDate(weekStart.toISOString())} a ${fmtDate(weekEnd.toISOString())}`;
        for (const to of effective.email_recipients) {
          try {
            await client.send({
              from: `${senderName} <${gmailUser}>`,
              to,
              subject,
              html: htmlReport,
              content: textReport,
            });
            await supabase.from("weekly_renewals_report_logs").insert({
              channel: "email",
              recipient: to,
              status: "sent",
              total_renewals: current.renewals.length,
              total_payments: current.payments.length,
              total_amount_brl: totals.totalBRL,
              total_amount_usd: totals.totalUSD,
              is_test: !!test,
            });
            results.push({ channel: "email", recipient: to, status: "sent" });
          } catch (e: any) {
            await supabase.from("weekly_renewals_report_logs").insert({
              channel: "email",
              recipient: to,
              status: "error",
              error_message: e.message?.substring(0, 500),
              total_renewals: current.renewals.length,
              total_payments: current.payments.length,
              total_amount_brl: totals.totalBRL,
              total_amount_usd: totals.totalUSD,
              is_test: !!test,
            });
            results.push({ channel: "email", recipient: to, status: "error", error: e.message });
          }
        }
        await client.close();
      } else {
        results.push({ channel: "email", status: "error", error: "Credenciais Gmail não configuradas" });
      }
    }

    if (!test && config?.id) {
      await supabase
        .from("weekly_renewals_report_config")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", config.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        preview: textReport,
        totals,
        counts: { renewals: current.renewals.length, payments: current.payments.length },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[weekly-renewals-report] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
