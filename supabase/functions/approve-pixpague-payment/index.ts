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
      .select("*, cliente:clientes(id, data_renovacao, ciclo_cobranca, nome, cobranca_ativa)")
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

    // 3) Renovação: Calcular a nova data ANTES do recibo
    let newRenewalDate: string | null = null;
    if (cliente?.id && cliente?.cobranca_ativa !== false && cliente?.data_renovacao && cliente?.ciclo_cobranca) {
      const { count: priorPaidCount } = await supabase
        .from("client_payments")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", cliente.id)
        .eq("status", "paid")
        .neq("id", paymentId);

      const isFirstPayment = (priorPaidCount ?? 0) === 0;

      if (!isFirstPayment) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const currentVenc = new Date(`${cliente.data_renovacao}T00:00:00`);
        const months = CYCLE_MONTHS[cliente.ciclo_cobranca] || 1;
        
        // Se a data atual de renovação já passou (atrasado), renova a partir de HOJE.
        // Se estiver em dia ou antecipado, renova a partir da data que já existia.
        const baseDate = currentVenc < today ? today : currentVenc;
        
        const renewalDate = new Date(baseDate);
        renewalDate.setMonth(renewalDate.getMonth() + months);
        newRenewalDate = renewalDate.toISOString().split("T")[0];

        await supabase
          .from("clientes")
          .update({ data_renovacao: newRenewalDate })
          .eq("id", cliente.id);

        console.log(`[approve-pixpague] Renovação (cliente ${cliente.id}): ${cliente.data_renovacao} -> ${newRenewalDate}`);
      }
    }

    // 4) Enviar recibo (agora com a data_renovacao já atualizada no banco se necessário)
    let receiptResult: any = null;
    let receiptError: string | null = null;

    if (cliente?.id && cliente?.cobranca_ativa !== false) {
      try {
        const { data, error } = await supabase.functions.invoke("send-receipt", {
          body: { clienteId: cliente.id, paymentId, paidAt },
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
