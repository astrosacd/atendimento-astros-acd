// Aprovação manual de pagamentos PixPague (módulo Segurança de Pagamento).
// Quando aprovado: marca como pago, calcula renovação a partir da data de vencimento atual,
// envia recibo. Quando rejeitado: marca como rejected (sem renovar).
// Para casos suspeitos (duplicate / mismatch / divergent), o aprovador DEVE fornecer uma
// justificativa (approvalReason). Sem justificativa, retorna 400.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Max-Age": "86400",
};

const CYCLE_MONTHS: Record<string, number> = {
  mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12,
};

// Soma meses sem "estourar" o mês (31/01 + 1 mês = 28/02, e não 03/03).
const addMonthsSafe = (isoDate: string, months: number): string => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const targetMonthIndex = (m - 1) + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

// "Hoje" no fuso do negócio (America/Fortaleza), evitando virada de dia por UTC.
const todayLocalISO = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());


// OCR statuses que exigem justificativa para serem aprovados
const SUSPICIOUS_OCR_STATUSES = new Set(["duplicate", "mismatch", "divergent"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    console.log("Request body:", rawBody);
    const { paymentId, action, approvalReason, rejectionReason, renewalMode } = JSON.parse(rawBody);
    // renewalMode: "anchor" (default) mantém a data âncora do cliente (data_renovacao + ciclo),
    //              "from_today" recalcula a partir de hoje (use quando o serviço foi pausado).
    const renewalModeExplicit = renewalMode === "from_today" || renewalMode === "anchor";
    const effectiveRenewalMode: "anchor" | "from_today" =
      renewalMode === "from_today" ? "from_today" : "anchor";

    if (!paymentId || !action) {
      return new Response(JSON.stringify({ error: "paymentId and action required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["approve", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "action must be 'approve' or 'reject'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate caller (must be authenticated admin/gerente/financeiro)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing Authorization header");
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error or no user found:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized", details: authError?.message }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("User authenticated:", user.email, user.id);

    const { data: canApprove, error: rpcError } = await supabase.rpc("can_approve_order", { user_uuid: user.id });
    
    if (rpcError) {
      console.error("RPC error (can_approve_order):", rpcError);
      return new Response(JSON.stringify({ error: "Internal Server Error during permission check" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!canApprove) {
      console.warn("User forbidden:", user.email);
      return new Response(JSON.stringify({ error: "Forbidden: not allowed to approve payments" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load payment
    const { data: payment, error: paymentError } = await supabase
      .from("client_payments")
      .select("*, cliente:clientes(id, data_renovacao, ciclo_cobranca, nome, cobranca_ativa, tags)")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.status !== "pending_approval") {
      return new Response(JSON.stringify({ error: `Payment already processed (status: ${payment.status})` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== REJECT ======
    if (action === "reject") {
      await supabase
        .from("client_payments")
        .update({
          status: "rejected",
          ocr_status: payment.ocr_status === "pending" ? "rejected_manual" : payment.ocr_status,
          approved_by: user.id,
          approved_by_email: user.email ?? null,
          approval_reason: rejectionReason ?? null,
        })
        .eq("id", paymentId);

      // Se era pagamento de reativação: remove tag 'reativacao-pendente' do cliente
      // (mantém 'cancelado' — cliente volta ao estado cancelado padrão).
      const clienteRej: any = payment.cliente;
      if (payment.is_reactivation && clienteRej?.id) {
        try {
          const existingTags: string[] = Array.isArray(clienteRej.tags) ? clienteRej.tags : [];
          const cleanedTags = existingTags.filter(
            (t: string) => t?.toLowerCase() !== "reativacao-pendente"
          );
          await supabase
            .from("clientes")
            .update({ tags: cleanedTags })
            .eq("id", clienteRej.id);
        } catch (e) {
          console.error("[approve-pixpague] Erro ao limpar tag reativacao-pendente:", e);
        }
      }

      return new Response(JSON.stringify({ success: true, action: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== APPROVE ======
    // Suspicious cases (duplicate / mismatch / divergent) MUST include a justification
    const isSuspicious = SUSPICIOUS_OCR_STATUSES.has(payment.ocr_status);
    const trimmedReason = (approvalReason ?? "").toString().trim();

    if (isSuspicious && trimmedReason.length < 5) {
      return new Response(
        JSON.stringify({
          error: "approval_reason_required",
          message:
            "Este pagamento foi sinalizado pela IA (duplicado ou valor divergente). É obrigatório informar uma justificativa de pelo menos 5 caracteres para aprovar.",
          ocr_status: payment.ocr_status,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paidAt = new Date().toISOString();

    // 1) Mark payment as paid + audit
    const { error: updateErr } = await supabase
      .from("client_payments")
      .update({
        status: "paid",
        paid_at: paidAt,
        approved_by: user.id,
        approved_by_email: user.email ?? null,
        approval_reason: trimmedReason || null,
        approval_override: isSuspicious,
      })
      .eq("id", paymentId);

    if (updateErr) {
      console.error("Erro ao atualizar pagamento:", updateErr);
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cliente: any = payment.cliente;

    // 1.5) REATIVAÇÃO: se este pagamento foi enviado como reativação, ao aprovar reativamos o cliente
    // (cobranca_ativa = true, remove tag 'cancelado' e 'reativacao-pendente') ANTES de calcular renovação/recibo.
    let reactivatedNow = false;
    if (payment.is_reactivation && cliente?.id) {
      try {
        const existingTags: string[] = Array.isArray(cliente.tags) ? cliente.tags : [];
        const cleanedTags = existingTags.filter(
          (t: string) => t?.toLowerCase() !== "cancelado" && t?.toLowerCase() !== "reativacao-pendente"
        );
        const { error: reactErr } = await supabase
          .from("clientes")
          .update({ cobranca_ativa: true, tags: cleanedTags })
          .eq("id", cliente.id);
        if (reactErr) {
          console.error("[approve-pixpague] Erro ao reativar cliente:", reactErr);
        } else {
          reactivatedNow = true;
          cliente.cobranca_ativa = true;
          cliente.tags = cleanedTags;
          console.log(`[approve-pixpague] Cliente ${cliente.id} REATIVADO após aprovação do pagamento ${paymentId}`);
        }
      } catch (e) {
        console.error("[approve-pixpague] Exceção ao reativar cliente:", e);
      }
    }


    // 2) Auto-cancelar TODAS as outras cobranças pendentes do cliente (D-3, D+1, etc.)
    if (cliente?.id) {
      try {
        const { data: cancelled, error: cancelErr } = await supabase
          .from("client_payments")
          .update({
            status: "cancelled",
            approval_reason: `Cancelado automaticamente — pago via ${payment.payment_type}`,
          })
          .eq("cliente_id", cliente.id)
          .in("status", ["pending", "pending_approval"])
          .neq("id", paymentId)
          .select("id, payment_type");

        if (cancelErr) {
          console.error("[approve-pixpague] Erro ao auto-cancelar outras cobranças:", cancelErr);
        } else if (cancelled && cancelled.length > 0) {
          console.log(`[approve-pixpague] Auto-canceladas ${cancelled.length} cobranças pendentes do cliente:`, cancelled.map((c: any) => `${c.id}(${c.payment_type})`).join(", "));
        }
      } catch (e) {
        console.error("[approve-pixpague] Exceção no auto-cancelamento:", e);
      }
    }

    // 2.5) Cancela ligações IA e SMS agendados pendentes (cliente já pagou)
    if (cliente?.id) {
      const { data: cancLig, error: errLig } = await supabase
        .from("ligacoes_agendadas")
        .update({ status: "cancelada", erro: "Cancelada automaticamente: pagamento aprovado", updated_at: new Date().toISOString() })
        .eq("cliente_id", cliente.id)
        .eq("status", "pendente")
        .select("id");
      if (errLig) console.error("[approve-pixpague] Erro cancelando ligações:", errLig);
      else console.log(`[approve-pixpague] Ligações IA canceladas: ${cancLig?.length ?? 0}`);

      const { data: cancSms, error: errSms } = await supabase
        .from("sms_agendados")
        .update({ status: "cancelado", updated_at: new Date().toISOString() })
        .eq("cliente_id", cliente.id)
        .eq("status", "pendente")
        .select("id");
      if (errSms) console.error("[approve-pixpague] Erro cancelando SMS:", errSms);
      else console.log(`[approve-pixpague] SMS cancelados: ${cancSms?.length ?? 0}`);
    }

    // 3) Renovação: Calcular a nova data ANTES do recibo
    let newRenewalDate: string | null = null;
    let renewalSkippedFirstPayment = false;
    if (cliente?.id && cliente?.cobranca_ativa !== false && cliente?.data_renovacao && cliente?.ciclo_cobranca) {
      const { count: priorPaidCount } = await supabase
        .from("client_payments")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", cliente.id)
        .eq("status", "paid")
        .neq("id", paymentId);

      const isFirstPayment = (priorPaidCount ?? 0) === 0;

      if (isFirstPayment) {
        renewalSkippedFirstPayment = true;
        console.log(`[approve-pixpague] Primeiro pagamento do cliente ${cliente.id}: mantém data_renovacao ${cliente.data_renovacao}`);
      } else {
        const months = CYCLE_MONTHS[cliente.ciclo_cobranca] || 1;

        // Regra padrão (anchor): mantém a âncora do cliente (data_renovacao + N meses),
        // independente de pagamento atrasado/antecipado. Isso preserva MRR/churn.
        // "from_today" recalcula a partir de hoje. A escolha explícita do operador
        // SEMPRE prevalece — reativação só força "hoje" quando nada foi escolhido.
        const useFromToday =
          effectiveRenewalMode === "from_today" || (reactivatedNow && !renewalModeExplicit);
        const baseDate = useFromToday ? todayLocalISO() : String(cliente.data_renovacao).slice(0, 10);

        newRenewalDate = addMonthsSafe(baseDate, months);

        await supabase
          .from("clientes")
          .update({ data_renovacao: newRenewalDate })
          .eq("id", cliente.id);

        console.log(`[approve-pixpague] Renovação (cliente ${cliente.id}, modo ${useFromToday ? "from_today" : "anchor"}): ${cliente.data_renovacao} -> ${newRenewalDate}`);
      }
    }

    // Data que será comunicada ao cliente no recibo (fonte única da verdade)
    const receiptRenewalDate: string | null =
      newRenewalDate ?? (cliente?.data_renovacao ? String(cliente.data_renovacao).slice(0, 10) : null);


    // 4) Enviar recibo (agora com a data_renovacao já atualizada no banco se necessário)
    let receiptResult: any = null;
    let receiptError: string | null = null;

    if (cliente?.id && cliente?.cobranca_ativa !== false) {
      try {
        const { data, error } = await supabase.functions.invoke("send-receipt", {
          body: { clienteId: cliente.id, paymentId, paidAt, nextRenewalDate: receiptRenewalDate },
        });
        if (error) {
          receiptError = error.message ?? String(error);
        } else {
          receiptResult = data;
        }
      } catch (e: any) {
        receiptError = e?.message ?? String(e);
      }
    }



    return new Response(
      JSON.stringify({
        success: true,
        action: "approved",
        paidAt,
        approval_override: isSuspicious,
        receipt: { sent: !receiptError, error: receiptError, details: receiptResult },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    console.error("approve-pixpague-payment error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
