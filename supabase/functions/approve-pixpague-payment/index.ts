// Aprovação manual de pagamentos PixPague (módulo Segurança de Pagamento).
// Quando aprovado: marca como pago, calcula renovação a partir da data de vencimento atual,
// envia recibo. Quando rejeitado: marca como rejected (sem renovar).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CYCLE_MONTHS: Record<string, number> = {
  mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { paymentId, action, rejectionReason } = await req.json();
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

    if (action === "reject") {
      await supabase
        .from("client_payments")
        .update({
          status: "rejected",
          ocr_status: payment.ocr_status === "pending" ? "rejected_manual" : payment.ocr_status,
        })
        .eq("id", paymentId);

      return new Response(JSON.stringify({ success: true, action: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === APPROVE ===
    const paidAt = new Date().toISOString();

    // 1) Mark payment as paid
    await supabase
      .from("client_payments")
      .update({ status: "paid", paid_at: paidAt })
      .eq("id", paymentId);

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

    // 3) Send receipt (best-effort)
    try {
      await supabase.functions.invoke("send-receipt", {
        body: { clienteId: cliente?.id, paymentId: payment.payment_id, paidAt },
      });
    } catch (e) {
      console.error("Erro ao enviar recibo:", e);
    }

    return new Response(JSON.stringify({ success: true, action: "approved", paidAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("approve-pixpague-payment error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
