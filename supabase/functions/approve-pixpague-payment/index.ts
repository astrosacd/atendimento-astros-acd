// Aprovação manual de pagamentos PixPague (módulo Segurança de Pagamento).
// Quando aprovado: marca como pago, calcula renovação a partir da data de vencimento atual,
// envia recibo. Quando rejeitado: marca como rejected (sem renovar).
// Para casos suspeitos (duplicate / mismatch / divergent), o aprovador DEVE fornecer uma
// justificativa (approvalReason). Sem justificativa, retorna 400.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CYCLE_MONTHS: Record<string, number> = {
  mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12,
};

// OCR statuses que exigem justificativa para serem aprovados
const SUSPICIOUS_OCR_STATUSES = new Set(["duplicate", "mismatch", "divergent"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { paymentId, action, approvalReason, rejectionReason } = await req.json();
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: canApprove } = await supabase.rpc("can_approve_order", { user_uuid: userData.user.id });
    if (!canApprove) {
      return new Response(JSON.stringify({ error: "Forbidden: not allowed to approve payments" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load payment
    const { data: payment, error: paymentError } = await supabase
      .from("client_payments")
      .select("*, cliente:clientes(id, data_renovacao, ciclo_cobranca, nome)")
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
          approved_by: userData.user.id,
          approved_by_email: userData.user.email ?? null,
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
        approved_by: userData.user.id,
        approved_by_email: userData.user.email ?? null,
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

    // 2) Renew cliente.data_renovacao from CURRENT renewal date (not today)
    const cliente: any = payment.cliente;
    if (cliente?.data_renovacao && cliente?.ciclo_cobranca) {
      const renewalDate = new Date(cliente.data_renovacao);
      const months = CYCLE_MONTHS[cliente.ciclo_cobranca] || 1;
      renewalDate.setMonth(renewalDate.getMonth() + months);
      const newRenewalDate = renewalDate.toISOString().split("T")[0];

      await supabase
        .from("clientes")
        .update({ data_renovacao: newRenewalDate })
        .eq("id", cliente.id);
    }

    // 3) Send receipt — use INTERNAL UUID (paymentId), not external payment_id
    let receiptResult: any = null;
    let receiptError: string | null = null;
    if (cliente?.id) {
      try {
        const { data, error } = await supabase.functions.invoke("send-receipt", {
          body: { clienteId: cliente.id, paymentId, paidAt },
        });
        if (error) {
          receiptError = error.message ?? String(error);
          console.error("Erro ao invocar send-receipt:", error);
        } else {
          receiptResult = data;
          console.log("send-receipt result:", JSON.stringify(data));
        }
      } catch (e: any) {
        receiptError = e?.message ?? String(e);
        console.error("Exceção ao enviar recibo:", e);
      }
    } else {
      receiptError = "cliente_id ausente no pagamento";
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
